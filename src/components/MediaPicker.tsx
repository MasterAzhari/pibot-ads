"use client";

import { useState } from "react";
import { uploadMedia } from "@/app/(app)/actions";

export type PickedMedia = { id: string; mimeType: string; filename: string };

export function MediaPicker({ value, onChange, accept = "image/*,video/*" }: { value: PickedMedia | null; onChange: (m: PickedMedia | null) => void; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadMedia(fd);
    setBusy(false);
    if (res.ok) onChange(res.data);
    else setError(res.error);
  }

  return (
    <div className="space-y-1">
      <input type="file" accept={accept} disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      {busy && <p className="text-xs muted">Uploading…</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && (
        <p className="text-xs">
          ✓ {value.filename} ({value.mimeType.startsWith("video/") ? "video" : "image"}){" "}
          <button type="button" className="underline muted" onClick={() => onChange(null)}>
            remove
          </button>
        </p>
      )}
    </div>
  );
}
