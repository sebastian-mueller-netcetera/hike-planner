"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Options {
  regions: string[];
  activityTypes: string[];
  difficulties: string[];
  destinationTypes: string[];
  seasons: string[];
}

export interface HikeFormData {
  name: string;
  region: string;
  activityType: string;
  difficultyRaw: string;
  maxElevationM: string;
  ascentM: string;
  descentM: string;
  distanceKm: string;
  isMultiDay: boolean;
  isLoop: boolean;
  startLocation: string;
  endLocation: string;
  destinationType: string;
  usesCableCar: boolean;
  season: string;
  notes: string;
  links: string[];
}

const EMPTY_FORM: HikeFormData = {
  name: "",
  region: "",
  activityType: "",
  difficultyRaw: "",
  maxElevationM: "",
  ascentM: "",
  descentM: "",
  distanceKm: "",
  isMultiDay: false,
  isLoop: false,
  startLocation: "",
  endLocation: "",
  destinationType: "",
  usesCableCar: false,
  season: "",
  notes: "",
  links: [],
};

interface HikeFormProps {
  initialData?: Partial<HikeFormData>;
  hikeId?: string; // If set, PATCH instead of POST
  title: string;
}

export default function HikeForm({ initialData, hikeId, title }: HikeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<HikeFormData>({ ...EMPTY_FORM, ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>({ regions: [], activityTypes: [], difficulties: [], destinationTypes: [], seasons: [] });

  useEffect(() => {
    fetch("/api/hikes/options")
      .then((res) => (res.ok ? res.json() : { regions: [], activityTypes: [], difficulties: [] }))
      .then(setOptions)
      .catch(() => {});
  }, []);

  function update(field: keyof HikeFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      region: form.region.trim() || null,
      activityType: form.activityType || null,
      difficultyRaw: form.difficultyRaw || null,
      maxElevationM: form.maxElevationM ? parseInt(form.maxElevationM) : null,
      ascentM: form.ascentM ? parseInt(form.ascentM) : null,
      descentM: form.descentM ? parseInt(form.descentM) : null,
      distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : null,
      isMultiDay: form.isMultiDay,
      isLoop: form.isLoop,
      startLocation: form.startLocation.trim() || null,
      endLocation: form.endLocation.trim() || null,
      destinationType: form.destinationType.trim() || null,
      usesCableCar: form.usesCableCar,
      season: form.season.trim() || null,
      notes: form.notes.trim() || null,
      links: form.links.filter((l) => l.trim() !== "").map((l) => l.trim()),
    };

    try {
      const url = hikeId ? `/api/hikes/${hikeId}` : "/api/hikes";
      const method = hikeId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Fehler: ${res.status}`);
      }

      const hike = await res.json();
      router.push(`/hikes/${hike.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded border bg-white p-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Name *
          </label>
          <input
            id="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>

        {/* Region + Activity */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="region" className="block text-sm font-medium">
              Region
            </label>
            <select
              id="region"
              value={form.region}
              onChange={(e) => update("region", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="">—</option>
              {options.regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="activityType" className="block text-sm font-medium">
              Sportart
            </label>
            <select
              id="activityType"
              value={form.activityType}
              onChange={(e) => update("activityType", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="">—</option>
              {options.activityTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Difficulty + Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="difficultyRaw" className="block text-sm font-medium">
              Schwierigkeit
            </label>
            <select
              id="difficultyRaw"
              value={form.difficultyRaw}
              onChange={(e) => update("difficultyRaw", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="">—</option>
              {options.difficulties.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="distanceKm" className="block text-sm font-medium">
              Distanz (km)
            </label>
            <input
              id="distanceKm"
              type="number"
              step="0.1"
              min="0"
              value={form.distanceKm}
              onChange={(e) => update("distanceKm", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="ascentM" className="block text-sm font-medium">
              Aufstieg (m)
            </label>
            <input
              id="ascentM"
              type="number"
              min="0"
              value={form.ascentM}
              onChange={(e) => update("ascentM", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="descentM" className="block text-sm font-medium">
              Abstieg (m)
            </label>
            <input
              id="descentM"
              type="number"
              min="0"
              value={form.descentM}
              onChange={(e) => update("descentM", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        {/* Max Elevation */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="maxElevationM" className="block text-sm font-medium">
              Max Höhe (m)
            </label>
            <input
              id="maxElevationM"
              type="number"
              min="0"
              value={form.maxElevationM}
              onChange={(e) => update("maxElevationM", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="startLocation" className="block text-sm font-medium">
              Start
            </label>
            <input
              id="startLocation"
              value={form.startLocation}
              onChange={(e) => update("startLocation", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="endLocation" className="block text-sm font-medium">
              Ziel
            </label>
            <input
              id="endLocation"
              value={form.endLocation}
              onChange={(e) => update("endLocation", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        {/* Destination type + Season */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="destinationType" className="block text-sm font-medium">
              Zielart
            </label>
            <select
              id="destinationType"
              value={form.destinationType}
              onChange={(e) => update("destinationType", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="">—</option>
              {options.destinationTypes.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="season" className="block text-sm font-medium">
              Saison
            </label>
            <select
              id="season"
              value={form.season}
              onChange={(e) => update("season", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="">—</option>
              {options.seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Booleans */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="isMultiDay" className="block text-sm font-medium">
              Mehrtagestour
            </label>
            <select
              id="isMultiDay"
              value={form.isMultiDay ? "true" : "false"}
              onChange={(e) => update("isMultiDay", e.target.value === "true")}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="false">Nein</option>
              <option value="true">Ja</option>
            </select>
          </div>
          <div>
            <label htmlFor="isLoop" className="block text-sm font-medium">
              Rundtour
            </label>
            <select
              id="isLoop"
              value={form.isLoop ? "true" : "false"}
              onChange={(e) => update("isLoop", e.target.value === "true")}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="false">Nein</option>
              <option value="true">Ja</option>
            </select>
          </div>
          <div>
            <label htmlFor="usesCableCar" className="block text-sm font-medium">
              Seilbahn
            </label>
            <select
              id="usesCableCar"
              value={form.usesCableCar ? "true" : "false"}
              onChange={(e) => update("usesCableCar", e.target.value === "true")}
              className="mt-1 block w-full rounded border px-3 py-2"
            >
              <option value="false">Nein</option>
              <option value="true">Ja</option>
            </select>
          </div>
        </div>

        {/* Links */}
        <div>
          <label className="block text-sm font-medium">Links</label>
          <div className="mt-1 space-y-2">
            {form.links.map((link, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => {
                    const updated = [...form.links];
                    updated[idx] = e.target.value;
                    setForm((prev) => ({ ...prev, links: updated }));
                  }}
                  className="block w-full rounded border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== idx) }));
                  }}
                  className="shrink-0 rounded border border-red-200 px-2 text-red-600 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, links: [...prev.links, ""] }))}
              className="rounded border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              + Link hinzufügen
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium">
            Notizen
          </label>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Speichern..." : "Speichern"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
