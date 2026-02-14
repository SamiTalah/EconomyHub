"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Plus, Minus, X, Package, Zap } from "lucide-react";
import { searchProducts } from "@/lib/actions";
import { PRESET_LISTS, CATEGORY_LABELS } from "@/lib/constants";
import type { ShoppingListItemInput } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductSuggestion {
  id: string;
  nameSv: string;
  brand: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  category: string;
  subcategory: string;
}

interface ShoppingListBuilderProps {
  items: ShoppingListItemInput[];
  onChange: (items: ShoppingListItemInput[]) => void;
}

export function ShoppingListBuilder({
  items,
  onChange,
}: ShoppingListBuilderProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(query);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const addProduct = useCallback(
    (product: ProductSuggestion) => {
      const existing = items.find((i) => i.productId === product.id);
      if (existing) {
        onChange(
          items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        );
      } else {
        onChange([
          ...items,
          {
            productId: product.id,
            freeTextName: product.nameSv,
            quantity: 1,
            allowSubstitutes: true,
          },
        ]);
      }
      setQuery("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [items, onChange]
  );

  const addFreeText = useCallback(() => {
    if (!query.trim()) return;
    onChange([
      ...items,
      {
        freeTextName: query.trim(),
        quantity: 1,
        allowSubstitutes: true,
      },
    ]);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [query, items, onChange]);

  const removeItem = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange]
  );

  const updateQuantity = useCallback(
    (index: number, delta: number) => {
      onChange(
        items
          .map((item, i) =>
            i === index
              ? { ...item, quantity: Math.max(1, item.quantity + delta) }
              : item
          )
      );
    },
    [items, onChange]
  );

  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = PRESET_LISTS.find((p) => p.id === presetId);
      if (!preset) return;
      const newItems: ShoppingListItemInput[] = preset.items.map((item) => ({
        freeTextName: item.name,
        quantity: item.quantity,
        allowSubstitutes: true,
      }));
      onChange(newItems);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        addProduct(suggestions[0]);
      } else {
        addFreeText();
      }
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Presets */}
      <div className="border-b px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Snabbval
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LISTS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset.id)}
              className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              <Zap className="h-3 w-3" />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="relative px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Sök produkt eller skriv varunamn..."
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover shadow-lg animate-slide-up">
            {suggestions.map((product) => (
              <button
                key={product.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addProduct(product)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent first:rounded-t-lg last:rounded-b-lg"
              >
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.nameSv}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.brand && `${product.brand} · `}
                    {product.sizeValue && `${product.sizeValue}${product.sizeUnit ?? ""} · `}
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Add as free text */}
        {query.trim() && !showSuggestions && (
          <button
            onClick={addFreeText}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Lägg till &quot;{query.trim()}&quot; som fritext
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="px-4 py-3">
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Din lista är tom
            </p>
            <p className="text-xs text-muted-foreground">
              Sök efter produkter eller använd ett snabbval
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {items.length} {items.length === 1 ? "vara" : "varor"}
              </span>
              <button
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Rensa alla
              </button>
            </div>
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent/50 animate-fade-in"
              >
                <span className="flex-1 text-sm truncate">
                  {item.freeTextName ?? "Okänd produkt"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border transition-colors hover:bg-accent"
                    aria-label="Minska antal"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border transition-colors hover:bg-accent"
                    aria-label="Öka antal"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Ta bort"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingCart(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="m1 1 4 1 3 11h12l3-8H7" />
    </svg>
  );
}
