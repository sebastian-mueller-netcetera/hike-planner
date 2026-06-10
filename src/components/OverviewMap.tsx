"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface HikeRoute {
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

interface OverviewMapProps {
  routes: HikeRoute[];
  onBoundsChange?: (bounds: MapBounds) => void;
}

const ROUTE_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#be185d", // pink
  "#4f46e5", // indigo
  "#ca8a04", // yellow
  "#059669", // emerald
];

export default function OverviewMap({ routes, onBoundsChange }: OverviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  const emitBounds = useCallback((map: L.Map) => {
    if (!onBoundsChangeRef.current) return;
    const b = map.getBounds();
    onBoundsChangeRef.current({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const allBounds = L.latLngBounds([]);

    routes.forEach((route, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

      const layer = L.geoJSON(route.geojson, {
        style: {
          color,
          weight: 3,
          opacity: 0.8,
        },
      }).addTo(map);

      // Popup with hike info and link
      const popupContent = `
        <div style="min-width:150px">
          <strong><a href="/hikes/${route.id}" style="color:${color}">${route.name}</a></strong>
          <br/><span style="font-size:12px;color:#666">
            ${[route.region, route.activityType, route.difficultyRaw].filter(Boolean).join(" · ")}
          </span>
          ${route.status === "completed" ? '<br/><span style="font-size:11px;color:#16a34a">✓ Erledigt</span>' : ""}
        </div>
      `;
      layer.bindPopup(popupContent);

      // Highlight on hover
      layer.on("mouseover", () => {
        layer.setStyle({ weight: 5, opacity: 1 });
      });
      layer.on("mouseout", () => {
        layer.setStyle({ weight: 3, opacity: 0.8 });
      });

      allBounds.extend(layer.getBounds());
    });

    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [30, 30] });
    }

    // Emit bounds after initial fit and on every move/zoom
    map.whenReady(() => emitBounds(map));
    map.on("moveend", () => emitBounds(map));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [routes, emitBounds]);

  if (routes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border shadow-sm">
      <div className="flex items-center justify-between bg-white px-4 py-2">
        <span className="text-sm font-medium text-gray-700">
          Karte ({routes.length} {routes.length === 1 ? "Tour" : "Touren"} mit GPX)
        </span>
      </div>
      <div
        ref={mapRef}
        className="h-72 w-full sm:h-80 lg:h-96"
        style={{ minHeight: "288px" }}
      />
    </div>
  );
}
