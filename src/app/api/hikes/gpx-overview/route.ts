import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface HikeWithGpx {
  id: string;
  name: string;
  region: string | null;
  activityType: string | null;
  difficultyRaw: string | null;
  status: string;
  gpxFile: {
    geojson: unknown;
    routeBounds: unknown;
    routeCenter: unknown;
  } | null;
}

export async function GET() {
  const hikes: HikeWithGpx[] = await prisma.hike.findMany({
    where: {
      gpxFile: { isNot: null },
    },
    select: {
      id: true,
      name: true,
      region: true,
      activityType: true,
      difficultyRaw: true,
      status: true,
      gpxFile: {
        select: {
          geojson: true,
          routeBounds: true,
          routeCenter: true,
        },
      },
    },
  });

  const result = hikes
    .filter((h) => h.gpxFile?.geojson)
    .map((h) => ({
      id: h.id,
      name: h.name,
      region: h.region,
      activityType: h.activityType,
      difficultyRaw: h.difficultyRaw,
      status: h.status,
      geojson: h.gpxFile!.geojson,
      bounds: h.gpxFile!.routeBounds,
      center: h.gpxFile!.routeCenter,
    }));

  return NextResponse.json(result);
}
