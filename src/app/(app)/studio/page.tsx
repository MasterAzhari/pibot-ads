import { Studio } from "./Studio";

export default function StudioPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">AI Studio</h1>
      <p className="text-sm muted">Plan short videos (TikTok / Reels) with a strong hook, scene by scene, plus a ready-to-use caption.</p>
      <Studio />
    </div>
  );
}
