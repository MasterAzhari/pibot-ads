"use client";

import { useState } from "react";
import { deletePostAction, publishNowAction, rescheduleAction, updateCaptionAction } from "../actions";

export function PostActions({ id, status, caption, noEdit }: { id: string; status: string; caption: string; noEdit: string[] }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(caption);
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done?: (data: any) => string | null) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setMsg(res.error ?? "Failed");
    else setMsg(done?.(res.data) ?? null);
  }

  const published = status === "PUBLISHED" || status === "PARTIAL";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(status === "DRAFT" || status === "SCHEDULED") && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => publishNowAction(id))}>
            Publish now
          </button>
        )}
        {(status === "FAILED" || status === "PARTIAL") && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => publishNowAction(id))}>
            Retry failed
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setEditing((e) => !e)}>
          Edit caption
        </button>
        {!published && (
          <span className="flex gap-1 items-center">
            <input type="datetime-local" className="!w-auto" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button className="btn btn-ghost" disabled={busy || !when} onClick={() => run(() => rescheduleAction(id, when), () => "Schedule updated")}>
              Reschedule
            </button>
          </span>
        )}
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={() => {
            if (confirm(published ? "Delete this post from the platforms too (where allowed)?" : "Delete this post?"))
              run(() => deletePostAction(id), (manual: string[]) => (manual?.length ? `Delete manually on: ${manual.join(", ")}` : null));
          }}
        >
          Delete
        </button>
      </div>
      {editing && (
        <div className="space-y-2">
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          {published && noEdit.length > 0 && (
            <p className="text-xs text-amber-600">The API does not allow caption edits for: {noEdit.join(", ")}. The others will be updated.</p>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(
                () => updateCaptionAction(id, text),
                (skipped: string[]) => {
                  setEditing(false);
                  return skipped?.length ? `Updated, except ${skipped.join(", ")}` : "Caption updated";
                },
              )
            }
          >
            Save caption
          </button>
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
