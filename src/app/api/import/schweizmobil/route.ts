import { prisma } from "@/lib/prisma";

// Swisstopo approximate formulas for Swiss → WGS84.
// Auto-detects LV95 (E > 2M) vs LV03 (E < 1M).
function swissToWgs84(easting: number, northing: number): [number, number] {
  if (easting > 2000000) {
    easting -= 2000000;
    northing -= 1000000;
  }
  const y = (easting - 600000) / 1000000;
  const x = (northing - 200000) / 1000000;

  const lambdaS =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y;

  const phiS =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x;

  return [(lambdaS * 100) / 36, (phiS * 100) / 36];
}

function transformFeatureToWgs84(feature: {
  geometry?: { type?: string; coordinates?: number[][] | number[][][] };
}) {
  const geom = feature.geometry;
  if (!geom?.coordinates) return;

  if (geom.type === "LineString") {
    geom.coordinates = (geom.coordinates as number[][]).map((coord) => {
      const [lon, lat] = swissToWgs84(coord[0], coord[1]);
      return coord.length > 2 ? [lon, lat, coord[2]] : [lon, lat];
    });
  } else if (geom.type === "MultiLineString") {
    geom.coordinates = (geom.coordinates as number[][][]).map((line) =>
      line.map((coord) => {
        const [lon, lat] = swissToWgs84(coord[0], coord[1]);
        return coord.length > 2 ? [lon, lat, coord[2]] : [lon, lat];
      })
    );
  }
}

function extractTrackId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const trackId = parsed.searchParams.get("trackId");
    if (trackId) return trackId;

    const tourMatch = url.match(/\/tour\/(\d+)/);
    if (tourMatch) return tourMatch[1];

    return null;
  } catch {
    return null;
  }
}

interface RouteInfo {
  land: "Wanderland" | "Mountainbike";
  routeNumber: number;
  category: "National" | "Regional" | "Lokal";
}

function extractRouteInfo(url: string): RouteInfo | null {
  const landMatch = url.match(/(wanderland|mountainbikeland)/i);
  if (!landMatch) return null;

  const routeMatch = url.match(/route-?0*(\d+)/i);
  if (!routeMatch) return null;

  const land = landMatch[1].toLowerCase().includes("mountain")
    ? "Mountainbike"
    : "Wanderland";
  const routeNumber = parseInt(routeMatch[1], 10);
  const digits = routeMatch[1].length;
  const category: RouteInfo["category"] =
    digits <= 1 ? "National" : digits === 2 ? "Regional" : "Lokal";

  return { land, routeNumber, category };
}

function buildRouteApiUrl(info: RouteInfo): string {
  const param = `${info.land}Routen${info.category}`;
  return `https://map.schweizmobil.ch/api/4/query/featuresmultilayers?${param}=${info.routeNumber}`;
}

function flattenMultiLineString(coordinates: number[][][]): number[][] {
  return coordinates.flat();
}

function computeBoundsAndCenter(coordinates: number[][]) {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  let totalLat = 0,
    totalLng = 0;

  for (const coord of coordinates) {
    const [lng, lat] = coord;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    totalLat += lat;
    totalLng += lng;
  }

  const bounds = [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
  const center = [totalLat / coordinates.length, totalLng / coordinates.length];

  // Haversine distance
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return { bounds, center, distanceM: Math.round(totalDistance) };
}

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Find hikes with schweizmobil links that don't already have a GPX file
      const hikesWithLinks = await prisma.hike.findMany({
        where: {
          gpxFile: null,
          links: {
            some: {
              url: { contains: "schweizmobil" },
            },
          },
        },
        include: {
          links: {
            where: { url: { contains: "schweizmobil" } },
          },
        },
      });

      const total = hikesWithLinks.length;
      send("start", { total });

      let success = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 0; i < hikesWithLinks.length; i++) {
        const hike = hikesWithLinks[i];

        // Find the first link with a valid trackId
        let trackId: string | null = null;
        for (const link of hike.links) {
          trackId = extractTrackId(link.url);
          if (trackId) break;
        }

        if (!trackId) {
          // Fallback: try route-based API (wanderland/mountainbikeland URLs)
          let routeInfo: RouteInfo | null = null;
          for (const link of hike.links) {
            routeInfo = extractRouteInfo(link.url);
            if (routeInfo) break;
          }

          if (!routeInfo) {
            skipped++;
            send("progress", {
              current: i + 1,
              total,
              hikeName: hike.name,
              status: "skipped",
              message: "Kein trackId oder Route-Nummer",
              success,
              skipped,
              errors,
            });
            continue;
          }

          try {
            const routeUrl = buildRouteApiUrl(routeInfo);
            const res = await fetch(routeUrl, {
              signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
              errors++;
              send("progress", {
                current: i + 1,
                total,
                hikeName: hike.name,
                status: "error",
                message: `Route-API ${res.status}`,
                success,
                skipped,
                errors,
              });
              continue;
            }

            const featureCollection = await res.json();
            const features = featureCollection.features || [];

            if (features.length === 0) {
              errors++;
              send("progress", {
                current: i + 1,
                total,
                hikeName: hike.name,
                status: "error",
                message: "Keine Features in Route",
                success,
                skipped,
                errors,
              });
              continue;
            }

            for (const feat of features) {
              transformFeatureToWgs84(feat);
            }

            let allCoords: number[][] = [];
            for (const feat of features) {
              const geom = feat.geometry;
              if (geom?.type === "MultiLineString") {
                allCoords = allCoords.concat(
                  flattenMultiLineString(geom.coordinates)
                );
              } else if (geom?.type === "LineString") {
                allCoords = allCoords.concat(geom.coordinates);
              }
            }

            if (allCoords.length === 0) {
              errors++;
              send("progress", {
                current: i + 1,
                total,
                hikeName: hike.name,
                status: "error",
                message: "Keine Koordinaten in Route",
                success,
                skipped,
                errors,
              });
              continue;
            }

            const { bounds, center, distanceM } =
              computeBoundsAndCenter(allCoords);
            const routeId = `route-${routeInfo.land.toLowerCase()}-${routeInfo.routeNumber}`;

            await prisma.hikeGpxFile.create({
              data: {
                hikeId: hike.id,
                originalFilename: `${routeId}.geojson`,
                mimeType: "application/geo+json",
                storagePath: `schweizmobil://${routeId}`,
                fileSizeBytes: JSON.stringify(featureCollection).length,
                geojson: featureCollection,
                routeBounds: bounds,
                routeCenter: center,
                routeDistanceM: distanceM,
              },
            });

            success++;
            send("progress", {
              current: i + 1,
              total,
              hikeName: hike.name,
              status: "success",
              success,
              skipped,
              errors,
            });
          } catch (e) {
            errors++;
            send("progress", {
              current: i + 1,
              total,
              hikeName: hike.name,
              status: "error",
              message: e instanceof Error ? e.message : "Unbekannt",
              success,
              skipped,
              errors,
            });
          }

          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        try {
          const res = await fetch(
            `https://schweizmobil.ch/api/4/tracks/${trackId}`,
            { signal: AbortSignal.timeout(10000) }
          );

          if (!res.ok) {
            errors++;
            send("progress", {
              current: i + 1,
              total,
              hikeName: hike.name,
              status: "error",
              message: `API ${res.status}`,
              success,
              skipped,
              errors,
            });
            continue;
          }

          const geojsonFeature = await res.json();

          // Transform Swiss LV95 → WGS84
          transformFeatureToWgs84(geojsonFeature);

          const geojson = {
            type: "FeatureCollection" as const,
            features: [geojsonFeature],
          };

          const coordinates: number[][] =
            geojsonFeature.geometry?.coordinates || [];

          if (coordinates.length === 0) {
            errors++;
            send("progress", {
              current: i + 1,
              total,
              hikeName: hike.name,
              status: "error",
              message: "Keine Koordinaten",
              success,
              skipped,
              errors,
            });
            continue;
          }

          const { bounds, center, distanceM } =
            computeBoundsAndCenter(coordinates);

          await prisma.hikeGpxFile.create({
            data: {
              hikeId: hike.id,
              originalFilename: `schweizmobil-${trackId}.geojson`,
              mimeType: "application/geo+json",
              storagePath: `schweizmobil://${trackId}`,
              fileSizeBytes: JSON.stringify(geojson).length,
              geojson,
              routeBounds: bounds,
              routeCenter: center,
              routeDistanceM: distanceM,
            },
          });

          success++;
          send("progress", {
            current: i + 1,
            total,
            hikeName: hike.name,
            status: "success",
            success,
            skipped,
            errors,
          });
        } catch (e) {
          errors++;
          send("progress", {
            current: i + 1,
            total,
            hikeName: hike.name,
            status: "error",
            message: e instanceof Error ? e.message : "Unbekannt",
            success,
            skipped,
            errors,
          });
        }

        // Small delay to be polite to Schweizmobil's API
        await new Promise((r) => setTimeout(r, 200));
      }

      send("done", { total, success, skipped, errors });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
