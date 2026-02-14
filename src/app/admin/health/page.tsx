import { prisma } from "@/lib/db";
import { getFreshness } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Database, Clock, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [prices, stores, products, flyers] = await Promise.all([
    prisma.regularPrice.findMany({ select: { observedAt: true, source: true } }),
    prisma.store.count(),
    prisma.product.count(),
    prisma.dealFlyer.findMany({
      select: { parseStatus: true, weekStart: true, weekEnd: true, dealItems: { select: { approved: true } } },
    }),
  ]);

  const now = new Date();
  let freshCount = 0;
  let agingCount = 0;
  let staleCount = 0;
  const sourceCounts: Record<string, number> = {};

  for (const p of prices) {
    const f = getFreshness(p.observedAt);
    if (f === "FRESH") freshCount++;
    else if (f === "AGING") agingCount++;
    else staleCount++;
    sourceCounts[p.source] = (sourceCounts[p.source] ?? 0) + 1;
  }

  const activeFlyers = flyers.filter(
    (f) => f.weekStart <= now && f.weekEnd >= now && f.parseStatus === "APPROVED"
  );
  const totalDeals = activeFlyers.reduce((s, f) => s + f.dealItems.filter((d) => d.approved).length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Systemhälsa</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Datakvalitet, färskhet och ingestion
      </p>

      {/* Freshness overview */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <HealthCard
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          title="Färska priser"
          value={freshCount}
          description="≤ 7 dagar"
          color="success"
        />
        <HealthCard
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          title="Åldrande priser"
          value={agingCount}
          description="8-14 dagar"
          color="warning"
        />
        <HealthCard
          icon={<XCircle className="h-5 w-5 text-destructive" />}
          title="Gamla priser"
          value={staleCount}
          description="> 14 dagar"
          color="destructive"
        />
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <Database className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-xl font-bold">{stores}</p>
          <p className="text-xs text-muted-foreground">Butiker</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-xl font-bold">{products}</p>
          <p className="text-xs text-muted-foreground">Produkter</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-xl font-bold">{prices.length}</p>
          <p className="text-xs text-muted-foreground">Prisobservationer</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-xl font-bold">{totalDeals}</p>
          <p className="text-xs text-muted-foreground">Aktiva erbjudanden</p>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Priskällor</h3>
        <div className="mt-3 space-y-2">
          {Object.entries(sourceCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <div key={source} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{source}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full bg-primary/20" style={{ width: `${Math.min(200, (count / prices.length) * 200)}px` }}>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / prices.length) * 100}%` }} />
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Active flyers */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Aktiva flygblad</h3>
        {activeFlyers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Inga aktiva flygblad denna vecka.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {activeFlyers.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>
                  Vecka {new Date(f.weekStart).toLocaleDateString("sv-SE")} –{" "}
                  {new Date(f.weekEnd).toLocaleDateString("sv-SE")}
                </span>
                <span className="font-medium">
                  {f.dealItems.filter((d) => d.approved).length} erbjudanden
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({
  icon,
  title,
  value,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value.toLocaleString("sv-SE")}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
