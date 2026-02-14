"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Link2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ConnectorInfo {
  name: string;
  configured: boolean;
  description: string;
}

interface StoreEntry {
  id: string;
  name: string;
  chain: string;
  format: string;
  externalStoreId: string | null;
  lastFetch: string | null;
  fetchedPriceCount: number;
}

interface FetchReport {
  storeId: string;
  storeName: string;
  chain: string;
  fetched: number;
  matched: number;
  created: number;
  pricesInserted: number;
  errors: string[];
  durationMs: number;
}

export function ConnectorDashboard() {
  const [connectors, setConnectors] = useState<Record<string, ConnectorInfo>>({});
  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingStore, setFetchingStore] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<FetchReport | null>(null);
  const [editingId, setEditingId] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/connectors");
      const data = await res.json();
      setConnectors(data.connectors ?? {});
      setStores(data.stores ?? []);
      const edits: Record<string, string> = {};
      for (const s of data.stores ?? []) {
        edits[s.id] = s.externalStoreId ?? "";
      }
      setEditingId(edits);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveExternalId(storeId: string) {
    await fetch("/api/admin/connectors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, externalStoreId: editingId[storeId] }),
    });
    await loadData();
  }

  async function triggerFetch(storeId: string) {
    setFetchingStore(storeId);
    setLastReport(null);
    try {
      const res = await fetch("/api/admin/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const data = await res.json();
      if (data.report) {
        setLastReport(data.report);
      } else if (data.error) {
        setLastReport({
          storeId,
          storeName: stores.find(s => s.id === storeId)?.name ?? "",
          chain: "",
          fetched: 0, matched: 0, created: 0, pricesInserted: 0,
          errors: [data.error],
          durationMs: 0,
        });
      }
      await loadData();
    } finally {
      setFetchingStore(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connector Status Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(connectors).map(([key, c]) => (
          <div
            key={key}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              {c.configured ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <h3 className="font-semibold">{c.name}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.description}
            </p>
          </div>
        ))}
      </div>

      {/* Fetch Report */}
      {lastReport && (
        <div className={`rounded-xl border p-4 ${lastReport.errors.length > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
          <h3 className="font-semibold">
            Hämtningsrapport — {lastReport.storeName}
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Hämtade:</span>{" "}
              <strong>{lastReport.fetched}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Matchade:</span>{" "}
              <strong>{lastReport.matched}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Nya produkter:</span>{" "}
              <strong>{lastReport.created}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Priser sparade:</span>{" "}
              <strong>{lastReport.pricesInserted}</strong>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastReport.durationMs}ms
          </p>
          {lastReport.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {lastReport.errors.slice(0, 5).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
              {lastReport.errors.length > 5 && (
                <p>...och {lastReport.errors.length - 5} till</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Store Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Butik</th>
              <th className="px-4 py-3 text-left font-medium">Kedja</th>
              <th className="px-4 py-3 text-left font-medium">Externt ID</th>
              <th className="px-4 py-3 text-left font-medium">Senaste hämtning</th>
              <th className="px-4 py-3 text-right font-medium">Priser</th>
              <th className="px-4 py-3 text-right font-medium">Åtgärd</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{store.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {store.chain}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingId[store.id] ?? ""}
                      onChange={(e) =>
                        setEditingId((prev) => ({
                          ...prev,
                          [store.id]: e.target.value,
                        }))
                      }
                      placeholder="t.ex. 12345"
                      className="w-28 rounded border bg-background px-2 py-1 text-xs"
                    />
                    {editingId[store.id] !== (store.externalStoreId ?? "") && (
                      <button
                        onClick={() => saveExternalId(store.id)}
                        className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                      >
                        Spara
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {store.lastFetch
                    ? new Date(store.lastFetch).toLocaleString("sv-SE")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {store.fetchedPriceCount > 0
                    ? store.fetchedPriceCount.toLocaleString("sv-SE")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => triggerFetch(store.id)}
                    disabled={
                      !store.externalStoreId || fetchingStore === store.id
                    }
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {fetchingStore === store.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Hämta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
