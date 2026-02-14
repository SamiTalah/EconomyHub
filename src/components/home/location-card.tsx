"use client";

import { useState, useCallback } from "react";
import { Navigation, MapPin } from "lucide-react";
import type { UserLocation } from "@/lib/types";
import { STOCKHOLM_CENTER } from "@/lib/constants";

interface LocationCardProps {
  location: UserLocation;
  onLocationChange: (loc: UserLocation) => void;
}

export function LocationCard({ location, onLocationChange }: LocationCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [latInput, setLatInput] = useState(location.lat.toString());
  const [lngInput, setLngInput] = useState(location.lng.toString());

  const isDefault =
    location.lat === STOCKHOLM_CENTER.lat &&
    location.lng === STOCKHOLM_CENTER.lng;

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolokalisering stöds inte av din webbläsare.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLatInput(pos.coords.latitude.toFixed(4));
        setLngInput(pos.coords.longitude.toFixed(4));
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Platsåtkomst nekad. Ange plats manuellt."
            : "Kunde inte hämta din plats. Försök igen."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onLocationChange]);

  const handleManualSave = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng) && lat >= 58 && lat <= 61 && lng >= 17 && lng <= 20) {
      onLocationChange({ lat, lng });
      setManualMode(false);
      setError(null);
    } else {
      setError("Ange giltiga koordinater inom Stockholmsområdet.");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {isDefault ? (
            <p className="text-sm text-muted-foreground">
              Stockholms centrum (standard)
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-medium">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
              <span className="ml-1.5 text-muted-foreground">
                (din plats)
              </span>
            </p>
          )}
          {error && (
            <p className="mt-1 text-xs text-destructive">{error}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGeolocate}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            Hitta mig
          </button>
          <button
            onClick={() => setManualMode(!manualMode)}
            className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent active:scale-95"
          >
            <MapPin className="h-3.5 w-3.5" />
            Ange
          </button>
        </div>
      </div>

      {manualMode && (
        <div className="mt-3 flex items-end gap-2 animate-slide-up">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Latitud</label>
            <input
              type="number"
              step="0.0001"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              className="mt-0.5 w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="59.3293"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Longitud</label>
            <input
              type="number"
              step="0.0001"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              className="mt-0.5 w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="18.0686"
            />
          </div>
          <button
            onClick={handleManualSave}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Spara
          </button>
        </div>
      )}
    </div>
  );
}
