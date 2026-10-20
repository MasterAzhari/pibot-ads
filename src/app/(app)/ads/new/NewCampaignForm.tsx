"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aiAudience, createCampaignAction, searchInterestsAction } from "../../actions";
import { MediaPicker, type PickedMedia } from "@/components/MediaPicker";
import type { Interest, Objective } from "@/lib/ads";

type AdAcc = { id: string; name: string; network: "META" | "TIKTOK"; currency: string };

const OBJECTIVES: [Objective, string][] = [
  ["TRAFFIC", "Trafik ke website / WhatsApp link"],
  ["AWARENESS", "Capai ramai orang (reach)"],
  ["VIDEO_VIEWS", "Tontonan video"],
  ["ENGAGEMENT", "Engagement post"],
];
const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "ORDER_NOW", "DOWNLOAD"];

export function NewCampaignForm({ adAccounts }: { adAccounts: AdAcc[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(adAccounts[0].id);
  const account = adAccounts.find((a) => a.id === accountId)!;
  const [product, setProduct] = useState("");
  const [f, setF] = useState({
    name: "",
    objective: "TRAFFIC" as Objective,
    dailyBudget: 20,
    countries: "MY",
    ageMin: 18,
    ageMax: 45,
    gender: "ALL" as "ALL" | "MALE" | "FEMALE",
    advantageAudience: true,
    primaryText: "",
    headline: "",
    link: "",
    cta: "LEARN_MORE",
  });
  const [interests, setInterests] = useState<Interest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Interest[]>([]);
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [reasoning, setReasoning] = useState<{ text: string; ideas: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function suggest() {
    setBusy("ai");
    setError(null);
    const res = await aiAudience(accountId, product, OBJECTIVES.find(([o]) => o === f.objective)![1]);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    const s = res.data.suggestion;
    setF((x) => ({ ...x, countries: s.countries.join(","), ageMin: s.ageMin, ageMax: s.ageMax, gender: s.gender, advantageAudience: s.advantageAudience }));
    setInterests(res.data.interests);
    setReasoning({ text: s.reasoning, ideas: s.customAudienceIdeas });
  }

  async function search() {
    const res = await searchInterestsAction(accountId, query);
    if (res.ok) setResults(res.data);
    else setError(res.error);
  }

  async function submit() {
    if (!media) return setError("Pilih video atau gambar iklan");
    setBusy("submit");
    setError(null);
    const res = await createCampaignAction(accountId, {
      ...f,
      countries: f.countries.split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase()),
      interests,
      mediaId: media.id,
    });
    setBusy(null);
    if (res.ok) router.push("/ads");
    else setError(res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="card grid gap-3 sm:grid-cols-2">
          <div>
            <label>Ad account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.network === "META" ? "Meta" : "TikTok"} · {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Nama kempen</label>
            <input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label>Objektif</label>
            <select value={f.objective} onChange={(e) => set("objective", e.target.value as Objective)}>
              {OBJECTIVES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Bajet harian ({account.currency})</label>
            <input type="number" min={1} value={f.dailyBudget} onChange={(e) => set("dailyBudget", Number(e.target.value))} />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Audience</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label>Negara (kod)</label>
              <input value={f.countries} onChange={(e) => set("countries", e.target.value)} />
            </div>
            <div>
              <label>Umur min</label>
              <input type="number" value={f.ageMin} onChange={(e) => set("ageMin", Number(e.target.value))} />
            </div>
            <div>
              <label>Umur max</label>
              <input type="number" value={f.ageMax} onChange={(e) => set("ageMax", Number(e.target.value))} />
            </div>
            <div>
              <label>Jantina</label>
              <select value={f.gender} onChange={(e) => set("gender", e.target.value as typeof f.gender)}>
                <option value="ALL">Semua</option>
                <option value="FEMALE">Perempuan</option>
                <option value="MALE">Lelaki</option>
              </select>
            </div>
          </div>
          {account.network === "META" && (
            <label className="!flex items-center gap-2 !font-normal text-sm">
              <input type="checkbox" className="!w-auto" checked={f.advantageAudience} onChange={(e) => set("advantageAudience", e.target.checked)} />
              Advantage+ audience (biar AI Meta luaskan audience; umur jadi cadangan sahaja)
            </label>
          )}
          <div>
            <label>Minat (interest)</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {interests.map((i) => (
                <span key={i.id} className="badge">
                  {i.name}{" "}
                  <button onClick={() => setInterests((s) => s.filter((x) => x.id !== i.id))} aria-label="buang">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder="cari minat, cth: hijab fashion" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn btn-ghost" onClick={search} disabled={!query}>
                Cari
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {results.map((r) => (
                <button key={r.id} className="badge" onClick={() => setInterests((s) => (s.some((x) => x.id === r.id) ? s : [...s, r]))}>
                  + {r.name}
                  {r.audienceSize ? ` (${(r.audienceSize / 1e6).toFixed(1)}j)` : ""}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Creative</h2>
          <MediaPicker value={media} onChange={setMedia} accept={account.network === "TIKTOK" ? "video/*" : "image/*,video/*"} />
          <div>
            <label>Teks utama</label>
            <textarea rows={3} value={f.primaryText} onChange={(e) => set("primaryText", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label>Tajuk</label>
              <input value={f.headline} onChange={(e) => set("headline", e.target.value)} />
            </div>
            <div>
              <label>Link destinasi</label>
              <input placeholder="https://wa.me/60…" value={f.link} onChange={(e) => set("link", e.target.value)} />
            </div>
            <div>
              <label>Butang</label>
              <select value={f.cta} onChange={(e) => set("cta", e.target.value)}>
                {CTAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn" disabled={!!busy} onClick={submit}>
          {busy === "submit" ? "Membina kempen (video boleh ambil beberapa minit)…" : "Bina kempen (PAUSE)"}
        </button>
      </div>

      <aside className="card space-y-3 h-fit">
        <h2 className="font-semibold">AI cadang audience</h2>
        <textarea
          rows={5}
          placeholder="Terangkan produk & pelanggan, cth: kek lapis Sarawak premium, hadiah korporat, pembeli KL/Selangor"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <button className="btn btn-ghost" disabled={busy === "ai" || !product} onClick={suggest}>
          {busy === "ai" ? "Menganalisis…" : "Cadangkan audience"}
        </button>
        {reasoning && (
          <div className="text-sm space-y-2">
            <p>{reasoning.text}</p>
            {reasoning.ideas.length > 0 && (
              <>
                <p className="font-semibold text-xs">Idea custom audience / retargeting:</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  {reasoning.ideas.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
