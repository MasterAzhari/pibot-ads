import { Studio } from "./Studio";

export default function StudioPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Studio AI</h1>
      <p className="text-sm muted">Rancang video pendek (TikTok / Reels) yang ada hook kuat, babak demi babak, dan caption sedia guna.</p>
      <Studio />
    </div>
  );
}
