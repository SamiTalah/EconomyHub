"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Store, Route, AlertTriangle, TrendingDown, CheckCircle2, ChevronDown, ChevronUp, Info, Package } from "lucide-react";
import { optimizeBasket } from "@/lib/actions";
import { formatSEK, formatKm, getFreshness, cn } from "@/lib/utils";
import { CHAIN_LABELS, FORMAT_LABELS } from "@/lib/constants";
import type { OptimizeRequest, OptimizeResponse, StoreResult, TwoStoreResult, ItemPriceExplanation } from "@/lib/types";

export function ResultsView() {
  const router = useRouter();
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"single" | "two" | "all">("single");

  useEffect(() => {
    const requestStr = sessionStorage.getItem("cartwise_request");
    if (!requestStr) {
      router.push("/");
      return;
    }
    const request: OptimizeRequest = JSON.parse(requestStr);
    optimizeBasket(request)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <ResultsSkeleton />;
  if (error) return <ErrorState message={error} onBack={() => router.push("/")} />;
  if (!result) return null;

  const { bestSingleStore, bestTwoStore, allSingleStores } = result;
  const hasTwoStore = bestTwoStore && bestTwoStore.netSavingsVsSingleSek > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-accent"
          aria-label="Tillbaka"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Resultat</h1>
          <p className="text-xs text-muted-foreground">
            {allSingleStores.length} butiker jämförda · {result.distanceMethod}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <TabButton active={activeTab === "single"} onClick={() => setActiveTab("single")}>
          Bästa butik
        </TabButton>
        {hasTwoStore && (
          <TabButton active={activeTab === "two"} onClick={() => setActiveTab("two")}>
            Bästa 2 butiker
          </TabButton>
        )}
        <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
          Alla alternativ
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === "single" && bestSingleStore && (
        <SingleStoreCard store={bestSingleStore} recommended disclaimer={result.distanceDisclaimer} />
      )}
      {activeTab === "single" && !bestSingleStore && (
        <EmptyState message="Inga butiker hittades inom vald radie." />
      )}

      {activeTab === "two" && hasTwoStore && bestTwoStore && (
        <TwoStoreCard result={bestTwoStore} bestSingleTotal={bestSingleStore?.totalCostSek ?? 0} disclaimer={result.distanceDisclaimer} />
      )}

      {activeTab === "all" && (
        <AllStoresTable stores={allSingleStores} />
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{result.distanceDisclaimer}</p>
            <p>Priser kan avvika i butik. Senast optimerat: {new Date(result.optimizedAt).toLocaleString("sv-SE")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SingleStoreCard({ store, recommended, disclaimer }: { store: StoreResult; recommended?: boolean; disclaimer: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header with badge */}
      {recommended && (
        <div className="bg-primary/5 border-b px-4 py-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Rekommenderat val</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Store info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{store.storeName}</h3>
            <p className="text-sm text-muted-foreground">
              {FORMAT_LABELS[store.format] ?? store.format}
              {store.address && ` · ${store.address}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatSEK(store.totalCostSek)}</p>
            <p className="text-xs text-muted-foreground">totalt</p>
          </div>
        </div>

        {/* Cost breakdown bar */}
        <CostBreakdownBar
          grocery={store.groceryCostSek}
          savings={store.dealsSavingsSek}
          travel={store.travelCostSek}
        />

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Matkostnad" value={formatSEK(store.groceryCostSek)} />
          <StatCard icon={<TrendingDown className="h-4 w-4 text-success" />} label="Besparingar" value={`-${formatSEK(store.dealsSavingsSek)}`} valueClass="text-success" />
          <StatCard icon={<Route className="h-4 w-4" />} label="Resa" value={`${formatSEK(store.travelCostSek)}`} subtitle={`${formatKm(store.travelDistanceKm)} t/r`} />
        </div>

        {/* Coverage + deals */}
        <div className="flex flex-wrap gap-2">
          <CoverageBadge percent={store.coveragePercent} />
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
            {store.dealsAppliedCount} erbjudanden
          </span>
          <FreshnessSummaryBadge items={store.items} />
        </div>

        {/* Missing items warning */}
        {store.missingItems.length > 0 && (
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-semibold text-warning-foreground">
                {store.missingItemCount} varor saknas
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {store.missingItems.map((item, i) => (
                <span key={i} className="rounded bg-background px-2 py-0.5 text-xs">
                  {item.itemName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expandable item list */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <span>Prisinformation per vara</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-1 animate-slide-up">
            {store.items.map((item, i) => (
              <ItemRow key={i} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TwoStoreCard({ result, bestSingleTotal, disclaimer }: { result: TwoStoreResult; bestSingleTotal: number; disclaimer: string }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="bg-success/5 border-b px-4 py-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold text-success">
            Spara {formatSEK(result.netSavingsVsSingleSek)} jämfört med en butik
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">2 butiker</h3>
            <p className="text-sm text-muted-foreground">
              {result.storeA.storeName} + {result.storeB.storeName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatSEK(result.totalCostSek)}</p>
            <p className="text-xs text-muted-foreground">totalt</p>
          </div>
        </div>

        <CostBreakdownBar
          grocery={result.combinedGroceryCostSek}
          savings={result.combinedDealsSavingsSek}
          travel={result.travelCostSek}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Butik 1{result.routeOrder === "A_THEN_B" ? " (först)" : ""}</p>
            <p className="font-semibold text-sm">{result.storeA.storeName}</p>
            <p className="text-xs text-muted-foreground">{FORMAT_LABELS[result.storeA.format]}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Butik 2{result.routeOrder === "B_THEN_A" ? " (först)" : ""}</p>
            <p className="font-semibold text-sm">{result.storeB.storeName}</p>
            <p className="text-xs text-muted-foreground">{FORMAT_LABELS[result.storeB.format]}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <CoverageBadge percent={result.coveragePercent} />
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
            {formatKm(result.travelDistanceKm)} resväg
          </span>
        </div>

        {result.missingItems.length > 0 && (
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-semibold text-warning-foreground">
                {result.missingItems.length} varor saknas i båda butiker
              </span>
            </div>
          </div>
        )}

        {/* Item assignment */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Varufördelning</p>
          {result.itemAssignment.map((assign, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1 text-sm hover:bg-accent/50">
              <span className="truncate">{assign.itemName}</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  assign.assignedStore === "A" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                )}>
                  {assign.assignedStore === "A" ? result.storeA.storeName : result.storeB.storeName}
                </span>
                <span className="text-xs text-muted-foreground">{formatSEK(assign.priceSek)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllStoresTable({ stores }: { stores: StoreResult[] }) {
  if (stores.length === 0) return <EmptyState message="Inga butiker hittades." />;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Butik</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Mat</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Resa</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Totalt</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Täckning</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores.map((store, i) => (
              <tr key={store.storeId} className="transition-colors hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{store.storeName}</p>
                  <p className="text-xs text-muted-foreground">{formatKm(store.distanceKm)}</p>
                </td>
                <td className="px-4 py-2.5 text-right">{formatSEK(store.groceryCostSek)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{formatSEK(store.travelCostSek)}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{formatSEK(store.totalCostSek)}</td>
                <td className="px-4 py-2.5 text-right">
                  <CoverageBadge percent={store.coveragePercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostBreakdownBar({ grocery, savings, travel }: { grocery: number; savings: number; travel: number }) {
  const total = grocery + travel;
  const groceryPct = total > 0 ? (grocery / total) * 100 : 0;
  const travelPct = total > 0 ? (travel / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary transition-all" style={{ width: `${groceryPct}%` }} />
        <div className="bg-primary/40 transition-all" style={{ width: `${travelPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Mat: {formatSEK(grocery)}</span>
        {savings > 0 && <span className="text-success">Besparat: {formatSEK(savings)}</span>}
        <span>Resa: {formatSEK(travel)}</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, valueClass }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
      <p className={cn("text-sm font-semibold", valueClass)}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CoverageBadge({ percent }: { percent: number }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-0.5 text-xs font-medium",
      percent >= 90 ? "bg-success/10 text-success" : percent >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
    )}>
      {Math.round(percent)}% täckning
    </span>
  );
}

function FreshnessSummaryBadge({ items }: { items: ItemPriceExplanation[] }) {
  const staleCount = items.filter(i => i.regularPriceFreshness === "STALE").length;
  const agingCount = items.filter(i => i.regularPriceFreshness === "AGING").length;
  if (staleCount === 0 && agingCount === 0) {
    return <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Färsk data</span>;
  }
  if (staleCount > 0) {
    return <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">{staleCount} gamla priser</span>;
  }
  return <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">{agingCount} åldrande priser</span>;
}

function ItemRow({ item }: { item: ItemPriceExplanation }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", item.missing && "opacity-60")}>
      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{item.itemName}</span>
          <span className="text-xs text-muted-foreground">×{item.quantity}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {item.dealApplied && (
            <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
              Erbjudande
            </span>
          )}
          {item.dealMemberOnly && item.dealApplied && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Medlemspris
            </span>
          )}
          {item.regularPriceFreshness && (
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              item.regularPriceFreshness === "FRESH" && "bg-success/10 text-success",
              item.regularPriceFreshness === "AGING" && "bg-warning/10 text-warning",
              item.regularPriceFreshness === "STALE" && "bg-destructive/10 text-destructive"
            )}>
              {item.regularPriceFreshness === "FRESH" ? "Färskt" : item.regularPriceFreshness === "AGING" ? "Åldras" : "Gammalt"}
            </span>
          )}
          {item.missing && (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Saknas
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        {item.missing ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <>
            <p className="font-medium">{formatSEK(item.effectiveTotalSek ?? 0)}</p>
            {item.dealApplied && item.regularPriceSek != null && (
              <p className="text-[10px] text-muted-foreground line-through">
                {formatSEK(item.regularPriceSek * item.quantity)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="space-y-1">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
      </div>
      <div className="h-10 rounded-lg bg-muted" />
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-20 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted" />)}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <Store className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-destructive/60" />
      <p className="mt-3 text-sm text-destructive">{message}</p>
      <button
        onClick={onBack}
        className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Tillbaka
      </button>
    </div>
  );
}
