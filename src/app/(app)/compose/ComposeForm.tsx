"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aiCaptions, createPost } from "../actions";
import { MediaPicker, type PickedMedia } from "@/components/MediaPicker";

type Acc = { id: string; name: string; platform: string; label: string };

const NEEDS_MEDIA = new Set(["INSTAGRAM", "TIKTOK"]);

export function ComposeForm({ accounts }: { accounts: Acc[] }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"now" | "schedule" | "draft">("schedule");
  const [when, setWhen] = useState("");
  const [brief, setBrief] = useState("");
  const [ideas, setIdeas] = useState<{ caption: string; hashtags: string[] }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = accounts.filter((a) => selected.includes(a.id));
  const missingMedia = !media && chosen.some((a) => NEEDS_MEDIA.has(a.platform));

  async function generate() {
    setBusy("ai");
    setError(null);
    const res = await aiCaptions(brief || caption, [...new Set(chosen.map((a) => a.label))]);
    setBusy(null);
    if (res.ok) setIdeas(res.data);
    else setError(res.error);
  }

  async function submit() {
    setBusy("submit");
    setError(null);
    const res = await createPost({ caption, mediaId: media?.id, accountIds: selected, mode, scheduledAt: when });
    setBusy(null);
    if (res.ok) router.push("/posts");
    else setError(res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card space-y-4 lg:col-span-2">
        <div>
          <label>Post ke</label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                className={`badge ${selected.includes(a.id) ? "!bg-blue-600 !text-white" : ""}`}
              >
                {a.label}: {a.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Caption</label>
          <textarea rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <p className="text-xs muted mt-1">{caption.length} aksara. Threads maksimum 500, TikTok 2200.</p>
        </div>
        <div>
          <label>Gambar / video</label>
          <MediaPicker value={media} onChange={setMedia} />
          {missingMedia && <p className="text-xs text-amber-600 mt-1">Instagram dan TikTok perlukan gambar atau video.</p>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label>Bila</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="schedule">Jadualkan</option>
              <option value="now">Post sekarang</option>
              <option value="draft">Simpan draf</option>
            </select>
          </div>
          {mode === "schedule" && (
            <div>
              <label>Tarikh & masa (waktu Malaysia)</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          )}
          <button className="btn" disabled={!!busy || !selected.length || missingMedia} onClick={submit}>
            {busy === "submit" ? "Sedang proses…" : mode === "now" ? "Post sekarang" : mode === "schedule" ? "Jadualkan" : "Simpan"}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Bantuan AI</h2>
        <div>
          <label>Terangkan post ni</label>
          <textarea rows={4} placeholder="cth: promosi tudung satin baru, diskaun 20% sampai Ahad" value={brief} onChange={(e) => setBrief(e.target.value)} />
        </div>
        <button className="btn btn-ghost" disabled={busy === "ai" || !(brief || caption)} onClick={generate}>
          {busy === "ai" ? "Menjana…" : "Cadang caption"}
        </button>
        {ideas.map((idea, i) => (
          <div key={i} className="border rounded-lg p-2 text-sm space-y-1" style={{ borderColor: "var(--border)" }}>
            <p className="whitespace-pre-line">{idea.caption}</p>
            <p className="muted text-xs">{idea.hashtags.join(" ")}</p>
            <button className="text-xs underline" onClick={() => setCaption(`${idea.caption}\n\n${idea.hashtags.join(" ")}`)}>
              Guna ini
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
