import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as toGeoJSON from "@tmcw/togeojson";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

function extractBoundsAndCenter(geojson: GeoJSON.FeatureCollection) {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  function processCoords(coords: number[]) {
    const [lng, lat] = coords;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  function walkGeometry(geometry: GeoJSON.Geometry) {
    if (geometry.type === "Point") {
      processCoords(geometry.coordinates);
    } else if (geometry.type === "LineString" || geometry.type === "MultiPoint") {
      geometry.coordinates.forEach(processCoords);
    } else if (geometry.type === "Polygon" || geometry.type === "MultiLineString") {
      geometry.coordinates.forEach((ring) => ring.forEach(processCoords));
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((poly) =>
        poly.forEach((ring) => ring.forEach(processCoords))
      );
    } else if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach(walkGeometry);
    }
  }

  for (const feature of geojson.features) {
    if (feature.geometry) walkGeometry(feature.geometry);
  }

  if (minLat === Infinity) return null;

  return {
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
    center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
  };
}

function calculateRouteDistance(geojson: GeoJSON.FeatureCollection): number {
  let totalDistance = 0;

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    const geom = feature.geometry;
    if (geom.type === "LineString") {
      for (let i = 1; i < geom.coordinates.length; i++) {
        const [lng1, lat1] = geom.coordinates[i - 1];
        const [lng2, lat2] = geom.coordinates[i];
        totalDistance += haversine(lat1, lng1, lat2, lng2);
      }
    } else if (geom.type === "MultiLineString") {
      for (const line of geom.coordinates) {
        for (let i = 1; i < line.length; i++) {
          const [lng1, lat1] = line[i - 1];
          const [lng2, lat2] = line[i];
          totalDistance += haversine(lat1, lng1, lat2, lng2);
        }
      }
    }
  }

  return Math.round(totalDistance * 100) / 100;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hike = await prisma.hike.findUnique({ where: { id } });
  if (!hike) {
    return NextResponse.json({ error: "Hike not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("gpx") as File | null;

  if (!file || !file.name.endsWith(".gpx")) {
    return NextResponse.json(
      { error: "A valid .gpx file is required" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.gpx`;
  const dir = join(UPLOAD_DIR, "gpx");
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, filename);
  await writeFile(storagePath, buffer);

  // Parse GPX to GeoJSON
  let geojson: GeoJSON.FeatureCollection | null = null;
  let routeBounds: number[][] | null = null;
  let routeCenter: number[] | null = null;
  let routeDistanceM: number | null = null;

  try {
    const gpxText = buffer.toString("utf-8");
    const doc = new DOMParser().parseFromString(gpxText, "application/xml");
    geojson = toGeoJSON.gpx(doc as unknown as Document) as GeoJSON.FeatureCollection;

    const boundsData = extractBoundsAndCenter(geojson);
    if (boundsData) {
      routeBounds = boundsData.bounds;
      routeCenter = boundsData.center;
    }
    routeDistanceM = calculateRouteDistance(geojson);
  } catch {
    // GPX parsing failed — store file but skip geojson
  }

  const gpxFile = await prisma.hikeGpxFile.upsert({
    where: { hikeId: id },
    create: {
      hikeId: id,
      originalFilename: file.name,
      mimeType: "application/gpx+xml",
      storagePath,
      fileSizeBytes: buffer.length,
      geojson: geojson ? JSON.parse(JSON.stringify(geojson)) : undefined,
      routeBounds: routeBounds ? JSON.parse(JSON.stringify(routeBounds)) : undefined,
      routeCenter: routeCenter ? JSON.parse(JSON.stringify(routeCenter)) : undefined,
      routeDistanceM: routeDistanceM ?? undefined,
    },
    update: {
      originalFilename: file.name,
      storagePath,
      fileSizeBytes: buffer.length,
      geojson: geojson ? JSON.parse(JSON.stringify(geojson)) : null,
      routeBounds: routeBounds ? JSON.parse(JSON.stringify(routeBounds)) : null,
      routeCenter: routeCenter ? JSON.parse(JSON.stringify(routeCenter)) : null,
      routeDistanceM: routeDistanceM ?? null,
    },
  });

  return NextResponse.json(gpxFile, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.hikeGpxFile.delete({ where: { hikeId: id } });
  return new NextResponse(null, { status: 204 });
}
