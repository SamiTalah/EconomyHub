"use client";

import { useState } from "react";
import { MapPin, Grid, List } from "lucide-react";
import { CHAIN_LABELS, FORMAT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StoreItem {
  id: string;
  name: string;
  chain: string;
  format: string;
  lat: number;
  lng: number;
  address: string | null;
}

const CHAIN_COLORS: Record<string, string> = {
  ICA: "bg-red-100 text-red-700",
  COOP: "bg-green-100 text-green-700",
  WILLYS: "bg-yellow-100 text-yellow-700",
  HEMKOP: "bg-orange-100 text-orange-700",
  CITY_GROSS: "bg-purple-100 text-purple-700",
  LIDL: "bg-blue-100 text-blue-700",
  OTHER: "bg-gray-100 text-gray-700",
};

export function StoresView({ stores }: { stores: StoreItem[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const chains = [...new Set(stores.map((s) => s.chain))].sort();
  const filtered = filter ? stores.filter((s) => s.chain === filter) : stores;

  return (
    <div className="space-y-4">
      {/* Chain filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-all",
            !filter ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
          )}
        >
          Alla ({stores.length})
        </button>
        {chains.map((chain) => {
          const count = stores.filter((s) => s.chain === chain).length;
          return (
            <button
              key={chain}
              onClick={() => setFilter(filter === chain ? null : chain)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filter === chain ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              {CHAIN_LABELS[chain] ?? chain} ({count})
            </button>
          );
        })}

        <div className="ml-auto flex gap-1">
          <button onClick={() => setView("grid")} className={cn("rounded-md p-1.5", view === "grid" ? "bg-accent" : "")}>
            <Grid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={cn("rounded-md p-1.5", view === "list" ? "bg-accent" : "")}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="rounded-xl border bg-muted/30 p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          Kartvy tillgänglig med MapLibre GL (kräver karttiles)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered.length} butiker inom Stockholmsområdet
        </p>
      </div>

      {/* Store cards */}
      {view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((store) => (
            <div key={store.id} className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{store.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {FORMAT_LABELS[store.format] ?? store.format}
                  </p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", CHAIN_COLORS[store.chain] ?? CHAIN_COLORS.OTHER)}>
                  {CHAIN_LABELS[store.chain] ?? store.chain}
                </span>
              </div>
              {store.address && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {store.address}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Butik</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kedja</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Format</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Adress</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((store) => (
                <tr key={store.id} className="transition-colors hover:bg-accent/30">
                  <td className="px-4 py-2.5 font-medium">{store.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", CHAIN_COLORS[store.chain] ?? CHAIN_COLORS.OTHER)}>
                      {CHAIN_LABELS[store.chain] ?? store.chain}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{FORMAT_LABELS[store.format] ?? store.format}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{store.address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
