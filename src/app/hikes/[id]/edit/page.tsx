"use client";

import { useEffect, useState } from "react";
import HikeForm, { HikeFormData } from "@/components/HikeForm";

export default function EditHikePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [initialData, setInitialData] = useState<Partial<HikeFormData> | null>(null);
  const [hikeId, setHikeId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      setHikeId(id);
      try {
        const res = await fetch(`/api/hikes/${id}`);
        if (!res.ok) throw new Error("Tour nicht gefunden");
        const hike = await res.json();
        setInitialData({
          name: hike.name ?? "",
          region: hike.region ?? "",
          activityType: hike.activityType ?? "",
          difficultyRaw: hike.difficultyRaw ?? "",
          maxElevationM: hike.maxElevationM?.toString() ?? "",
          ascentM: hike.ascentM?.toString() ?? "",
          descentM: hike.descentM?.toString() ?? "",
          distanceKm: hike.distanceKm?.toString() ?? "",
          isMultiDay: hike.isMultiDay ?? false,
          isLoop: hike.isLoop ?? false,
          startLocation: hike.startLocation ?? "",
          endLocation: hike.endLocation ?? "",
          destinationType: hike.destinationType ?? "",
          usesCableCar: hike.usesCableCar ?? false,
          season: hike.season ?? "",
          notes: hike.notes ?? "",
          links: hike.links?.map((l: { url: string }) => l.url) ?? [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    }
    load();
  }, [params]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!initialData) {
    return <p className="text-gray-500">Laden...</p>;
  }

  return (
    <HikeForm
      title="Tour bearbeiten"
      initialData={initialData}
      hikeId={hikeId}
    />
  );
}
