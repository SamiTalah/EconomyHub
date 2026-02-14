"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Link2,
  Edit2,
} from "lucide-react";

interface DealItemEntry {
  id: string;
  normalizedName: string;
  dealPriceSek: number;
  multiBuyType: string;
  confidenceScore: number;
  approved: boolean;
  memberOnly: boolean;
}

interface FlyerEntry {
  id: string;
  title: string;
  sourceType: string;
  parseStatus: string;
  weekStart: string;
  weekEnd: string;
  rawAssetPath: string | null;
  createdAt: string;
  store: { id: string; name: string; chain: string } | null;
  _count: { dealItems: number };
  dealItems: DealItemEntry[];
}

export function OcrReview() {
  const [flyers, setFlyers] = useState<FlyerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [expandedFlyer, setExpandedFlyer] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFlyers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flyers");
      const data = await res.json();
      setFlyers(data.flyers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlyers();
  }, [loadFlyers]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);

      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else {
        await loadFlyers();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function fetchFromUrl() {
    if (!urlInput.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), title: "Flygblad från URL" }),
      });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else {
        setUrlInput("");
        await loadFlyers();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setUploading(false);
    }
  }

  async function toggleItemApproval(itemId: string, approved: boolean) {
    await fetch(`/api/admin/deals/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    await loadFlyers();
  }

  async function saveItemEdit(itemId: string) {
    const updates: Record<string, unknown> = {};
    if (editName) updates.normalizedName = editName;
    if (editPrice) updates.dealPriceSek = parseFloat(editPrice);

    await fetch(`/api/admin/deals/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setEditingItem(null);
    await loadFlyers();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/admin/deals/${itemId}`, { method: "DELETE" });
    await loadFlyers();
  }

  async function updateFlyerStatus(flyerId: string, status: string, autoApproveThreshold?: number) {
    await fetch(`/api/admin/flyers/${flyerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parseStatus: status, autoApproveThreshold }),
    });
    await loadFlyers();
  }

  async function deleteFlyer(flyerId: string) {
    await fetch(`/api/admin/flyers/${flyerId}`, { method: "DELETE" });
    await loadFlyers();
  }

  function confidenceColor(score: number) {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
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
      {/* Upload Section */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Ladda upp flygblad</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ladda upp en PDF eller bild, eller klistra in en URL från kampanjveckan.se, ereklamblad.se etc.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* File Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Dra och släpp PDF/bild här
            </p>
            <p className="text-xs text-muted-foreground">eller klicka för att välja</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </div>

          {/* URL Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Eller klistra in URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <button
                onClick={fetchFromUrl}
                disabled={!urlInput.trim() || uploading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Hämta
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              kampanjveckan.se, ereklamblad.se, dinareklamblad.se, lidl.se
            </p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Bearbetar flygblad med OCR...
          </div>
        )}

        {uploadError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {uploadError}
          </div>
        )}
      </div>

      {/* Flyers List */}
      {flyers.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Inga flygblad ännu. Ladda upp en PDF ovan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flyers.map((flyer) => {
            const isExpanded = expandedFlyer === flyer.id;
            const approvedCount = flyer.dealItems.filter((i) => i.approved).length;
            const totalCount = flyer.dealItems.length;

            return (
              <div key={flyer.id} className="rounded-xl border bg-card shadow-sm">
                {/* Flyer Header */}
                <div
                  className="flex cursor-pointer items-center justify-between p-4"
                  onClick={() => setExpandedFlyer(isExpanded ? null : flyer.id)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{flyer.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {flyer.store?.name ?? "Okänd butik"} •{" "}
                        {new Date(flyer.weekStart).toLocaleDateString("sv-SE")} –{" "}
                        {new Date(flyer.weekEnd).toLocaleDateString("sv-SE")} •{" "}
                        {approvedCount}/{totalCount} godkända
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        flyer.parseStatus === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : flyer.parseStatus === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : flyer.parseStatus === "PARSED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {flyer.parseStatus}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {/* Flyer Actions */}
                    <div className="flex flex-wrap gap-2 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFlyerStatus(flyer.id, "APPROVED", 80);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        <Check className="h-3 w-3" />
                        Godkänn alla (≥80%)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFlyerStatus(flyer.id, "APPROVED", 95);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Check className="h-3 w-3" />
                        Auto-godkänn (≥95%)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFlyerStatus(flyer.id, "REJECTED");
                        }}
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      >
                        <X className="h-3 w-3" />
                        Avvisa alla
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFlyer(flyer.id);
                        }}
                        className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        Ta bort flygblad
                      </button>
                    </div>

                    {/* Deal Items Table */}
                    {flyer.dealItems.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="pb-2 pr-4">Produkt</th>
                              <th className="pb-2 pr-4">Pris</th>
                              <th className="pb-2 pr-4">Typ</th>
                              <th className="pb-2 pr-4">Konfidens</th>
                              <th className="pb-2 text-right">Åtgärd</th>
                            </tr>
                          </thead>
                          <tbody>
                            {flyer.dealItems.map((item) => (
                              <tr
                                key={item.id}
                                className={`border-b last:border-0 ${
                                  item.confidenceScore < 80
                                    ? "bg-amber-50/50"
                                    : ""
                                }`}
                              >
                                <td className="py-2 pr-4">
                                  {editingItem === item.id ? (
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) =>
                                        setEditName(e.target.value)
                                      }
                                      className="w-full rounded border px-2 py-1 text-xs"
                                    />
                                  ) : (
                                    <span className="font-medium">
                                      {item.normalizedName}
                                      {item.memberOnly && (
                                        <span className="ml-1 text-xs text-purple-600">
                                          [Medlem]
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-4">
                                  {editingItem === item.id ? (
                                    <input
                                      type="number"
                                      value={editPrice}
                                      onChange={(e) =>
                                        setEditPrice(e.target.value)
                                      }
                                      className="w-20 rounded border px-2 py-1 text-xs"
                                      step="0.01"
                                    />
                                  ) : (
                                    <span>{item.dealPriceSek.toFixed(2)} kr</span>
                                  )}
                                </td>
                                <td className="py-2 pr-4 text-xs text-muted-foreground">
                                  {item.multiBuyType !== "NONE"
                                    ? item.multiBuyType.replace(/_/g, " ")
                                    : "—"}
                                </td>
                                <td className="py-2 pr-4">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor(item.confidenceScore)}`}
                                  >
                                    {item.confidenceScore}%
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {editingItem === item.id ? (
                                      <>
                                        <button
                                          onClick={() => saveItemEdit(item.id)}
                                          className="rounded bg-primary p-1 text-primary-foreground"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setEditingItem(null)
                                          }
                                          className="rounded border p-1"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingItem(item.id);
                                            setEditName(item.normalizedName);
                                            setEditPrice(
                                              item.dealPriceSek.toString()
                                            );
                                          }}
                                          className="rounded border p-1 hover:bg-muted"
                                          title="Redigera"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                        {item.approved ? (
                                          <button
                                            onClick={() =>
                                              toggleItemApproval(
                                                item.id,
                                                false
                                              )
                                            }
                                            className="rounded bg-green-600 p-1 text-white"
                                            title="Godkänd — klicka för att ångra"
                                          >
                                            <Check className="h-3 w-3" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              toggleItemApproval(
                                                item.id,
                                                true
                                              )
                                            }
                                            className="rounded border border-green-300 p-1 text-green-600 hover:bg-green-50"
                                            title="Godkänn"
                                          >
                                            <Check className="h-3 w-3" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => deleteItem(item.id)}
                                          className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50"
                                          title="Ta bort"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Inga erbjudanden hittades i detta flygblad.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
