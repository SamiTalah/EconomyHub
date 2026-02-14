import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const item = await prisma.dealItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Deal item not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.approved != null) updateData.approved = body.approved;
  if (body.normalizedName) updateData.normalizedName = body.normalizedName;
  if (body.dealPriceSek != null) updateData.dealPriceSek = body.dealPriceSek;
  if (body.productId !== undefined) updateData.productId = body.productId || null;
  if (body.multiBuyType) updateData.multiBuyType = body.multiBuyType;
  if (body.multiBuyX !== undefined) updateData.multiBuyX = body.multiBuyX;
  if (body.multiBuyY !== undefined) updateData.multiBuyY = body.multiBuyY;
  if (body.conditionsText !== undefined) updateData.conditionsText = body.conditionsText;
  if (body.memberOnly != null) updateData.memberOnly = body.memberOnly;
  if (body.limitPerHousehold !== undefined) updateData.limitPerHousehold = body.limitPerHousehold;
  if (body.brand !== undefined) updateData.brand = body.brand;

  const updated = await prisma.dealItem.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.dealItem.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
