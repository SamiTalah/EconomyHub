import { prisma } from "@/lib/db";
import { Upload, FileSpreadsheet, Activity, Package, Store, Tag, Plug } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [storeCount, productCount, priceCount, dealCount, flyerCount] =
    await Promise.all([
      prisma.store.count(),
      prisma.product.count(),
      prisma.regularPrice.count(),
      prisma.dealItem.count({ where: { approved: true } }),
      prisma.dealFlyer.count(),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hantera prisdata, erbjudanden och övervakning
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AdminStatCard icon={<Store className="h-5 w-5" />} label="Butiker" value={storeCount} />
        <AdminStatCard icon={<Package className="h-5 w-5" />} label="Produkter" value={productCount} />
        <AdminStatCard icon={<Tag className="h-5 w-5" />} label="Priser" value={priceCount} />
        <AdminStatCard icon={<FileSpreadsheet className="h-5 w-5" />} label="Erbjudanden" value={dealCount} />
        <AdminStatCard icon={<Activity className="h-5 w-5" />} label="Flygblad" value={flyerCount} />
      </div>

      {/* Navigation */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminNavCard
          href="/admin/prices/upload"
          icon={<Upload className="h-6 w-6" />}
          title="Ladda upp priser"
          description="Importera CSV med ordinarie priser"
        />
        <AdminNavCard
          href="/admin/deals"
          icon={<FileSpreadsheet className="h-6 w-6" />}
          title="Erbjudanden"
          description="Flygblad, OCR och veckans deals"
        />
        <AdminNavCard
          href="/admin/connectors"
          icon={<Plug className="h-6 w-6" />}
          title="API-kopplingar"
          description="Hämta priser från ICA, Willys, Coop"
        />
        <AdminNavCard
          href="/admin/health"
          icon={<Activity className="h-6 w-6" />}
          title="Systemhälsa"
          description="Datakvalitet och färskhet"
        />
      </div>
    </div>
  );
}

function AdminStatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-muted-foreground">{icon}</div>
      <p className="mt-2 text-2xl font-bold">{value.toLocaleString("sv-SE")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AdminNavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="text-primary/70 transition-colors group-hover:text-primary">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </a>
  );
}
