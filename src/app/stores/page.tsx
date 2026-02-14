import { prisma } from "@/lib/db";
import { StoresView } from "@/components/stores/stores-view";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await prisma.store.findMany({
    where: { city: "Stockholm" },
    orderBy: { name: "asc" },
  });

  const storesData = stores.map((s) => ({
    id: s.id,
    name: s.name,
    chain: s.chain,
    format: s.format,
    lat: s.lat,
    lng: s.lng,
    address: s.address,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Butiker i Stockholm</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {stores.length} butiker med prisdata
        </p>
      </div>
      <StoresView stores={storesData} />
    </div>
  );
}
