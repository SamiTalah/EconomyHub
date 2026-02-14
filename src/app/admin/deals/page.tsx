import { prisma } from "@/lib/db";
import { DealsManager } from "@/components/admin/deals-manager";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const flyers = await prisma.dealFlyer.findMany({
    include: {
      dealItems: true,
      store: true,
    },
    orderBy: { weekStart: "desc" },
    take: 20,
  });

  const flyerData = flyers.map((f) => ({
    id: f.id,
    title: f.title,
    storeName: f.store?.name ?? "Alla butiker",
    storeId: f.storeId,
    sourceType: f.sourceType,
    weekStart: f.weekStart.toISOString(),
    weekEnd: f.weekEnd.toISOString(),
    parseStatus: f.parseStatus,
    itemCount: f.dealItems.length,
    approvedCount: f.dealItems.filter((d) => d.approved).length,
    items: f.dealItems.map((d) => ({
      id: d.id,
      normalizedName: d.normalizedName,
      brand: d.brand,
      dealPriceSek: d.dealPriceSek,
      multiBuyType: d.multiBuyType,
      multiBuyX: d.multiBuyX,
      multiBuyY: d.multiBuyY,
      conditionsText: d.conditionsText,
      memberOnly: d.memberOnly,
      limitPerHousehold: d.limitPerHousehold,
      confidenceScore: d.confidenceScore,
      approved: d.approved,
    })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Erbjudanden</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hantera flygblad, veckans erbjudanden och manuell inmatning
      </p>
      <div className="mt-6">
        <DealsManager flyers={flyerData} />
      </div>
    </div>
  );
}
