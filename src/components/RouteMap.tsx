"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  geojson: GeoJSON.FeatureCollection;
  bounds?: number[][];
  center?: number[];
}

export default function RouteMap({ geojson, bounds, center }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const geoLayer = L.geoJSON(geojson, {
      style: {
        color: "#2563eb",
        weight: 3,
        opacity: 0.8,
      },
    }).addTo(map);

    if (bounds && bounds.length === 2) {
      map.fitBounds([
        [bounds[0][0], bounds[0][1]],
        [bounds[1][0], bounds[1][1]],
      ], { padding: [20, 20] });
    } else if (center) {
      map.setView([center[0], center[1]], 12);
    } else {
      map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geojson, bounds, center]);

  return (
    <div
      ref={mapRef}
      className="h-64 w-full rounded sm:h-80 lg:h-96"
      style={{ minHeight: "256px" }}
    />
  );
}
