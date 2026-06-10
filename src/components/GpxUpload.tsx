"use client";

import { useState, useRef } from "react";

interface GpxUploadProps {
  hikeId: string;
  onUploaded: () => void;
}

export default function GpxUpload({ hikeId, onUploaded }: GpxUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("gpx", file);

    try {
      const res = await fetch(`/api/hikes/${hikeId}/gpx`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Fehler: ${res.status}`);
      }

      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="gpx-file" className="block text-sm font-medium text-gray-600">
            GPX-Datei hochladen
          </label>
          <input
            ref={fileRef}
            id="gpx-file"
            type="file"
            accept=".gpx"
            required
            className="mt-1 block w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Hochladen..." : "Hochladen"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
