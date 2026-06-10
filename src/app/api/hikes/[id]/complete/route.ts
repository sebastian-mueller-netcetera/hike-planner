import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hike = await prisma.hike.update({
    where: { id },
    data: {
      status: "completed",
      completedDate: new Date(),
    },
  });

  return NextResponse.json(hike);
}
