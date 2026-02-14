"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadResult {
  inserted: number;
  updated: number;
  errors: string[];
  storesCreated: number;
  productsCreated: number;
}

export function PriceUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Endast CSV-filer stöds.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/prices", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload misslyckades");
      }

      const data: UploadResult = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-6">
      {/* CSV format info */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-sm">CSV-format</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Kolumner (semikolon- eller kommaseparerade):
        </p>
        <code className="mt-2 block rounded-lg bg-muted p-3 text-xs overflow-x-auto">
          store_name;chain;format;city;lat;lng;gtin;product_name_sv;brand;size_value;size_unit;category;subcategory;price_sek;unit_price_sek;unit_unit;in_stock;observed_at
        </code>
        <a
          href="/api/admin/prices/template"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Download className="h-3 w-3" />
          Ladda ner mall (CSV)
        </a>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/50",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {uploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Laddar upp...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              Dra och släpp CSV-fil här
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              eller klicka för att välja fil
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border bg-card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h3 className="font-semibold">Upload slutförd</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Priser skapade" value={result.inserted} />
            <ResultStat label="Priser uppdaterade" value={result.updated} />
            <ResultStat label="Butiker skapade" value={result.storesCreated} />
            <ResultStat label="Produkter skapade" value={result.productsCreated} />
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-warning/10 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-semibold text-warning-foreground">
                  {result.errors.length} varningar
                </span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>...och {result.errors.length - 10} till</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
