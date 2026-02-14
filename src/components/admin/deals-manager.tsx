"use client";

import { useState } from "react";
import { Plus, Upload, FileText, Check, X, AlertTriangle, Eye, ChevronDown, ChevronUp, ScanText } from "lucide-react";
import { cn } from "@/lib/utils";
import { OcrReview } from "./ocr-review";

interface DealItemData {
  id: string;
  normalizedName: string;
  brand: string | null;
  dealPriceSek: number;
  multiBuyType: string;
  multiBuyX: number | null;
  multiBuyY: number | null;
  conditionsText: string | null;
  memberOnly: boolean;
  limitPerHousehold: number | null;
  confidenceScore: number;
  approved: boolean;
}

interface FlyerData {
  id: string;
  title: string;
  storeName: string;
  storeId: string | null;
  sourceType: string;
  weekStart: string;
  weekEnd: string;
  parseStatus: string;
  itemCount: number;
  approvedCount: number;
  items: DealItemData[];
}

export function DealsManager({ flyers }: { flyers: FlyerData[] }) {
  const [activeTab, setActiveTab] = useState<"list" | "upload" | "manual" | "ocr">("list");
  const [expandedFlyer, setExpandedFlyer] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <TabBtn active={activeTab === "list"} onClick={() => setActiveTab("list")}>
          <Eye className="h-3.5 w-3.5" /> Flygblad
        </TabBtn>
        <TabBtn active={activeTab === "upload"} onClick={() => setActiveTab("upload")}>
          <Upload className="h-3.5 w-3.5" /> Importera JSON
        </TabBtn>
        <TabBtn active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
          <Plus className="h-3.5 w-3.5" /> Manuell
        </TabBtn>
        <TabBtn active={activeTab === "ocr"} onClick={() => setActiveTab("ocr")}>
          <ScanText className="h-3.5 w-3.5" /> OCR Flygblad
        </TabBtn>
      </div>

      {/* Flyer list */}
      {activeTab === "list" && (
        <div className="space-y-3">
          {flyers.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                Inga flygblad ännu
              </p>
            </div>
          ) : (
            flyers.map((flyer) => (
              <div key={flyer.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedFlyer(expandedFlyer === flyer.id ? null : flyer.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <h3 className="font-semibold">{flyer.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {flyer.storeName} · {new Date(flyer.weekStart).toLocaleDateString("sv-SE")} – {new Date(flyer.weekEnd).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        flyer.parseStatus === "APPROVED" ? "bg-success/10 text-success" : flyer.parseStatus === "PENDING" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                      )}>
                        {flyer.parseStatus}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {flyer.approvedCount}/{flyer.itemCount} godkända
                      </p>
                    </div>
                    {expandedFlyer === flyer.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {expandedFlyer === flyer.id && (
                  <div className="border-t px-4 py-3 animate-slide-up">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 text-left font-medium">Produkt</th>
                          <th className="pb-2 text-right font-medium">Pris</th>
                          <th className="pb-2 text-right font-medium">Typ</th>
                          <th className="pb-2 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {flyer.items.map((item) => (
                          <tr key={item.id} className="hover:bg-accent/30">
                            <td className="py-2">
                              <p className="font-medium">{item.normalizedName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {item.brand && <span className="text-xs text-muted-foreground">{item.brand}</span>}
                                {item.memberOnly && (
                                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Medlem</span>
                                )}
                                {item.limitPerHousehold && (
                                  <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">Max {item.limitPerHousehold}/hushåll</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 text-right font-medium">
                              {item.multiBuyType === "X_FOR_Y" ? (
                                <span>{item.multiBuyX} för {item.multiBuyY} kr</span>
                              ) : (
                                <span>{item.dealPriceSek} kr</span>
                              )}
                            </td>
                            <td className="py-2 text-right text-xs text-muted-foreground">
                              {item.multiBuyType === "NONE" ? "Direkt" : item.multiBuyType.replace(/_/g, " ")}
                            </td>
                            <td className="py-2 text-right">
                              {item.approved ? (
                                <Check className="ml-auto h-4 w-4 text-success" />
                              ) : (
                                <X className="ml-auto h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* JSON Import */}
      {activeTab === "upload" && <JsonImporter />}

      {/* Manual entry */}
      {activeTab === "manual" && <ManualDealEntry />}

      {/* OCR Flygblad */}
      {activeTab === "ocr" && <OcrReview />}
    </div>
  );
}

function JsonImporter() {
  const [json, setJson] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    setUploading(true);
    try {
      const res = await fetch("/api/admin/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "json_import", data: JSON.parse(json) }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ imported: 0, errors: ["Ogiltigt JSON-format"] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">JSON-importformat</h3>
        <code className="block rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre">
{`{
  "store_name": "Willys Hornstull",
  "chain": "WILLYS",
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "items": [
    {
      "name": "Nötfärs 500g",
      "brand": "Garant",
      "price_sek": 39.90,
      "multi_buy_type": "NONE",
      "member_only": false,
      "conditions": null,
      "gtin": null
    }
  ]
}`}
        </code>
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={10}
        placeholder="Klistra in JSON här..."
        className="w-full rounded-xl border bg-background p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        onClick={handleImport}
        disabled={!json.trim() || uploading}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {uploading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Importera
      </button>

      {result && (
        <div className="rounded-xl border bg-card p-4 animate-slide-up">
          <p className="font-semibold">{result.imported} erbjudanden importerade</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-destructive space-y-1">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ManualDealEntry() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name || !price) return;
    setSaving(true);
    try {
      await fetch("/api/admin/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "manual_entry",
          data: { normalizedName: name, dealPriceSek: parseFloat(price) },
        }),
      });
      setSaved(true);
      setName("");
      setPrice("");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold">Snabb inmatning</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Produktnamn</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mjölk 3% 1.5L"
            className="mt-0.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Dealpris (kr)</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="15.90"
            className="mt-0.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!name || !price || saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Lägg till
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success animate-fade-in">
            <Check className="h-3 w-3" /> Sparat!
          </span>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
