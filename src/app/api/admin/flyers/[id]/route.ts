import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const flyer = await prisma.dealFlyer.findUnique({ where: { id } });
  if (!flyer) {
    return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.parseStatus) {
    if (!["PENDING", "PARSED", "APPROVED", "REJECTED"].includes(body.parseStatus)) {
      return NextResponse.json({ error: "Invalid parseStatus" }, { status: 400 });
    }
    updateData.parseStatus = body.parseStatus;
  }

  if (body.title) updateData.title = body.title;
  if (body.weekStart) updateData.weekStart = new Date(body.weekStart);
  if (body.weekEnd) updateData.weekEnd = new Date(body.weekEnd);

  // If approving the flyer, also approve all high-confidence items
  if (body.parseStatus === "APPROVED" && body.autoApproveThreshold != null) {
    await prisma.dealItem.updateMany({
      where: {
        flyerId: id,
        confidenceScore: { gte: body.autoApproveThreshold },
      },
      data: { approved: true },
    });
  }

  const updated = await prisma.dealFlyer.update({
    where: { id },
    data: updateData,
    include: {
      dealItems: {
        select: {
          id: true,
          normalizedName: true,
          dealPriceSek: true,
          confidenceScore: true,
          approved: true,
        },
      },
    },
  });

  return NextResponse.json({ flyer: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.dealFlyer.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
