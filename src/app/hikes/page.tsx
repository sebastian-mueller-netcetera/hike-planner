"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MapBounds } from "@/components/OverviewMap";

const OverviewMap = dynamic(() => import("@/components/OverviewMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-lg border bg-gray-100 sm:h-80 lg:h-96" />
  ),
});

interface Hike {
  id: string;
  name: string;
  region: string | null;
  activityType: string | null;
  difficultyRaw: string | null;
  maxElevationM: number | null;
  ascentM: number | null;
  descentM: number | null;
  distanceKm: string | null;
  isMultiDay: boolean;
  isLoop: boolean;
  startLocation: string | null;
  endLocation: string | null;
  destinationType: string | null;
  usesCableCar: boolean;
  season: string | null;
  status: string;
  completedDate: string | null;
  source: string;
  createdAt: string;
  links: { id: string; url: string; position: number }[];
}

interface Options {
  regions: string[];
  activityTypes: string[];
  difficulties: string[];
}

interface GpxRoute {
  id: string;
  name: string;
  region: string | null;
  activityType: string | null;
  difficultyRaw: string | null;
  status: string;
  geojson: GeoJSON.FeatureCollection;
  bounds: number[][] | null;
  center: number[] | null;
}

export default function HikesPage() {
  const [hikes, setHikes] = useState<Hike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gpxRoutes, setGpxRoutes] = useState<GpxRoute[]>([]);
  const [options, setOptions] = useState<Options>({ regions: [], activityTypes: [], difficulties: [] });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [activityType, setActivityType] = useState("");
  const [gpxFilter, setGpxFilter] = useState("");
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const fetchHikes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (difficulty) params.set("difficulty", difficulty);
    if (activityType) params.set("activityType", activityType);

    try {
      const res = await fetch(`/api/hikes?${params.toString()}`);
      if (!res.ok) throw new Error(`Fehler: ${res.status}`);
      const data = await res.json();
      setHikes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [search, status, difficulty, activityType]);

  useEffect(() => {
    const timeout = setTimeout(fetchHikes, 300);
    return () => clearTimeout(timeout);
  }, [fetchHikes]);

  useEffect(() => {
    fetch("/api/hikes/gpx-overview")
      .then((res) => (res.ok ? res.json() : []))
      .then(setGpxRoutes)
      .catch(() => setGpxRoutes([]));
    fetch("/api/hikes/options")
      .then((res) => (res.ok ? res.json() : { regions: [], activityTypes: [], difficulties: [] }))
      .then(setOptions)
      .catch(() => {});
  }, []);

  const gpxHikeIds = useMemo(
    () => new Set(gpxRoutes.map((r) => r.id)),
    [gpxRoutes]
  );

  const filteredRoutes = useMemo(() => {
    return gpxRoutes.filter((route) => {
      if (status && route.status !== status) return false;
      if (difficulty && route.difficultyRaw !== difficulty) return false;
      if (activityType && route.activityType !== activityType) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = route.name.toLowerCase().includes(q);
        const regionMatch = route.region?.toLowerCase().includes(q);
        if (!nameMatch && !regionMatch) return false;
      }
      return true;
    });
  }, [gpxRoutes, status, difficulty, activityType, search]);

  const gpxCenterMap = useMemo(() => {
    const map = new Map<string, number[]>();
    gpxRoutes.forEach((r) => {
      if (r.center) map.set(r.id, r.center);
    });
    return map;
  }, [gpxRoutes]);

  const filteredHikes = useMemo(() => {
    let result = hikes;

    if (gpxFilter === "with_gpx") {
      result = result.filter((h) => gpxHikeIds.has(h.id));
    } else if (gpxFilter === "without_gpx") {
      result = result.filter((h) => !gpxHikeIds.has(h.id));
      return result;
    }

    if (!mapBounds) return result;
    return result.filter((hike) => {
      const center = gpxCenterMap.get(hike.id);
      if (!center) return true;
      const [lat, lng] = center;
      return (
        lat >= mapBounds.south &&
        lat <= mapBounds.north &&
        lng >= mapBounds.west &&
        lng <= mapBounds.east
      );
    });
  }, [hikes, mapBounds, gpxCenterMap, gpxFilter, gpxHikeIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Touren</h1>
        <Link
          href="/hikes/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Neue Tour
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Alle Status</option>
          <option value="planned">Geplant</option>
          <option value="completed">Erledigt</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Alle Schwierigkeiten</option>
          {options.difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Alle Sportarten</option>
          {options.activityTypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={gpxFilter}
          onChange={(e) => setGpxFilter(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Alle Touren</option>
          <option value="with_gpx">Mit GPX</option>
          <option value="without_gpx">Ohne GPX</option>
        </select>
        {(search || status || difficulty || activityType || gpxFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setStatus("");
              setDifficulty("");
              setActivityType("");
              setGpxFilter("");
            }}
            className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Overview Map */}
      {gpxFilter !== "without_gpx" && filteredRoutes.length > 0 && <OverviewMap routes={filteredRoutes} onBoundsChange={setMapBounds} />}

      {/* Results */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Laden...</p>
      ) : filteredHikes.length === 0 ? (
        <p className="text-gray-500">Keine Touren gefunden.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">{filteredHikes.length} Touren{filteredHikes.length !== hikes.length ? ` (von ${hikes.length})` : ""}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHikes.map((hike) => (
              <Link
                key={hike.id}
                href={`/hikes/${hike.id}`}
                className="block rounded border bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {gpxHikeIds.has(hike.id) && (
                      <span className="shrink-0 text-green-600" title="GPX-Track vorhanden">
                        📍
                      </span>
                    )}
                    <h2 className="font-semibold leading-tight">{hike.name}</h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      hike.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {hike.status === "completed" ? "Erledigt" : "Geplant"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  {hike.region && <span>{hike.region}</span>}
                  {hike.activityType && <span>{hike.activityType}</span>}
                  {hike.difficultyRaw && (
                    <span className="font-medium">{hike.difficultyRaw}</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  {hike.distanceKm && <span>{hike.distanceKm} km</span>}
                  {hike.ascentM && <span>↑{hike.ascentM} m</span>}
                  {hike.descentM && <span>↓{hike.descentM} m</span>}
                  {hike.maxElevationM && <span>⛰ {hike.maxElevationM} m</span>}
                </div>

                {hike.season && (
                  <p className="mt-1 text-xs text-gray-400">{hike.season}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
