"use client";

import { useState } from "react";
import { aiVideoPlan } from "../actions";
import type { VideoPlan } from "@/lib/ai/tasks";

export function Studio() {
  const [brief, setBrief] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await aiVideoPlan(brief, seconds);
    setBusy(false);
    if (res.ok) setPlan(res.data);
    else setError(res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card space-y-3 h-fit">
        <div>
          <label>Produk / idea video</label>
          <textarea rows={6} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="cth: serum muka untuk kulit berminyak, target wanita 20-35, harga RM49" />
        </div>
        <div>
          <label>Panjang video</label>
          <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
            {[15, 30, 45, 60].map((s) => (
              <option key={s} value={s}>
                {s} saat
              </option>
            ))}
          </select>
        </div>
        <button className="btn" disabled={busy || !brief} onClick={go}>
          {busy ? "Menulis skrip…" : "Jana rancangan video"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      {plan && (
        <div className="card space-y-4 lg:col-span-2">
          <div>
            <div className="text-xs muted">Hook (3 saat pertama)</div>
            <p className="text-lg font-semibold">{plan.hook}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Saat</th>
                <th>Visual</th>
                <th>Suara</th>
                <th>Teks atas skrin</th>
              </tr>
            </thead>
            <tbody>
              {plan.scenes.map((s, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{s.seconds}</td>
                  <td>{s.visual}</td>
                  <td>{s.voiceover}</td>
                  <td>{s.onScreenText}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div className="text-xs muted">CTA</div>
            <p>{plan.cta}</p>
          </div>
          <div>
            <div className="text-xs muted">Caption</div>
            <p className="whitespace-pre-line text-sm">{plan.caption}</p>
          </div>
          <div>
            <div className="text-xs muted">Tips</div>
            <ul className="list-disc pl-4 text-sm">
              {plan.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
