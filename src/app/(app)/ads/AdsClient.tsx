"use client";

import { useState } from "react";
import { decideRecommendation, runAnalysisAction, setBudgetAction, syncAdsAction, toggleCampaign } from "../actions";

function useRunner() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? (ok ?? null) : (res.error ?? "Failed"));
  }
  return { busy, msg, run };
}

export function AdsToolbar() {
  const { busy, msg, run } = useRunner();
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs">{msg}</span>}
      <button className="btn btn-ghost" disabled={busy} onClick={() => run(syncAdsAction, "Data updated")}>
        Sync
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => run(runAnalysisAction, "Analysis done")}>
        {busy ? "…" : "Run AI analysis"}
      </button>
    </div>
  );
}

export function CampaignControls({ id, active, budget, currency }: { id: string; active: boolean; budget: number | null; currency: string }) {
  const { busy, msg, run } = useRunner();
  const [value, setValue] = useState(budget ?? 0);
  return (
    <div className="space-y-1 min-w-44">
      <div className="flex gap-1">
        <input type="number" min={1} step="0.01" className="!w-24" value={value} onChange={(e) => setValue(Number(e.target.value))} />
        <button className="btn btn-ghost" disabled={busy || value === budget} onClick={() => run(() => setBudgetAction(id, value), "OK")}>
          Set {currency}
        </button>
      </div>
      <button
        className={`btn ${active ? "btn-ghost" : ""}`}
        disabled={busy}
        onClick={() => {
          if (active || confirm("Turn this campaign on? Ads will start spending."))
            run(() => toggleCampaign(id, !active));
        }}
      >
        {active ? "Pause" : "Turn on"}
      </button>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}

export function RecommendationButtons({ id, actionable }: { id: string; actionable: boolean }) {
  const { busy, msg, run } = useRunner();
  return (
    <div className="flex gap-2 items-center">
      <button className="btn" disabled={busy} onClick={() => run(() => decideRecommendation(id, true))}>
        {actionable ? "Approve & apply" : "Got it"}
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => decideRecommendation(id, false))}>
        Reject
      </button>
      {msg && <span className="text-xs text-red-500">{msg}</span>}
    </div>
  );
}
