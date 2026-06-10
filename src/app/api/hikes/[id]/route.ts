import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hike = await prisma.hike.findUnique({
    where: { id },
    include: { links: { orderBy: { position: "asc" } }, gpxFile: true },
  });

  if (!hike) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(hike);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { links, ...data } = body;

  const hike = await prisma.hike.update({
    where: { id },
    data,
  });

  if (Array.isArray(links)) {
    await prisma.hikeLink.deleteMany({ where: { hikeId: id } });
    if (links.length > 0) {
      await prisma.hikeLink.createMany({
        data: links.map((url: string, i: number) => ({
          hikeId: id,
          url,
          position: i + 1,
        })),
      });
    }
  }

  return NextResponse.json(hike);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.hike.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
