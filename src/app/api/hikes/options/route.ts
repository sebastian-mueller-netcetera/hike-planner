import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [regions, activityTypes, difficulties, destinationTypes, seasons] = await Promise.all([
    prisma.hike.findMany({
      where: { region: { not: null } },
      select: { region: true },
      distinct: ["region"],
      orderBy: { region: "asc" },
    }),
    prisma.hike.findMany({
      where: { activityType: { not: null } },
      select: { activityType: true },
      distinct: ["activityType"],
      orderBy: { activityType: "asc" },
    }),
    prisma.hike.findMany({
      where: { difficultyRaw: { not: null } },
      select: { difficultyRaw: true },
      distinct: ["difficultyRaw"],
      orderBy: { difficultyRaw: "asc" },
    }),
    prisma.hike.findMany({
      where: { destinationType: { not: null } },
      select: { destinationType: true },
      distinct: ["destinationType"],
      orderBy: { destinationType: "asc" },
    }),
    prisma.hike.findMany({
      where: { season: { not: null } },
      select: { season: true },
      distinct: ["season"],
      orderBy: { season: "asc" },
    }),
  ]);

  return NextResponse.json({
    regions: regions.map((r: { region: string | null }) => r.region).filter(Boolean),
    activityTypes: activityTypes.map((a: { activityType: string | null }) => a.activityType).filter(Boolean),
    difficulties: difficulties.map((d: { difficultyRaw: string | null }) => d.difficultyRaw).filter(Boolean),
    destinationTypes: destinationTypes.map((d: { destinationType: string | null }) => d.destinationType).filter(Boolean),
    seasons: seasons.map((s: { season: string | null }) => s.season).filter(Boolean),
  });
}
