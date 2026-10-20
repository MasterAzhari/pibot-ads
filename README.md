# Pibot Ads

Dashboard untuk auto-post, jadual, edit dan urus iklan di **Facebook, Instagram, Threads dan TikTok**, dengan pembantu AI (Claude, OpenAI atau Meta Llama) untuk caption, skrip video, cadangan audience dan analisis prestasi iklan setiap hari.

Live: `https://ads.pibot.io` (VPS Hostinger, di belakang caddy-gen).

## Apa yang ada

| Bahagian | Fungsi |
| --- | --- |
| **Buat post** | Satu caption + gambar/video ke banyak akaun sekali gus. Post sekarang, jadualkan (waktu Malaysia) atau simpan draf. AI cadang 3 caption + hashtag. |
| **Post & jadual** | Status setiap platform, link ke post, cuba semula yang gagal, jadual semula, edit caption, padam. |
| **Iklan** | Senarai kempen Meta & TikTok dengan spend, klik, CTR, CPC, tontonan (7 hari). Hidup/pause, ubah bajet harian. |
| **Kempen baru** | Objektif, bajet, audience (negara, umur, jantina, minat, Advantage+), creative video/gambar, CTA. AI cadang audience dan cari interest ID sebenar. Kempen sentiasa dibuat **PAUSE**. |
| **Cadangan AI** | Setiap pagi (8 pagi MYT) worker sync data iklan dan minta AI cadangkan pause / naik bajet / info. **Tiada apa berubah sampai kau tekan Approve.** |
| **Studio AI** | Rancang video pendek 9:16: hook 3 saat, babak demi babak, CTA, caption, tips. |
| **Tetapan AI** | Pilih provider untuk tugas ringan & berat, model, fallback, harga model, had bajet AI sebulan. |

### Had platform (dari API, bukan dari sistem ni)

| | Edit caption lepas post | Padam lewat API | Nota |
| --- | --- | --- | --- |
| Facebook Page | ✓ | ✓ | |
| Instagram | ✗ | ✗ | Perlu gambar/video. Akaun Business/Creator yang link ke FB Page. |
| Threads | ✗ | ✓ | Teks maksimum 500 aksara. |
| TikTok | ✗ | ✗ | Sebelum app lulus audit TikTok, post hanya `SELF_ONLY` (private). Post gambar perlukan domain `ads.pibot.io` disahkan di portal TikTok. |

## Kos AI rendah

- Sambung **terus** ke Anthropic / OpenAI / Meta Llama API. Tiada OpenRouter atau orang tengah.
- Tugas ringan guna model murah (default `claude-haiku-5-5`), tugas berat (audience, analisis) guna model berat (default `claude-opus-5-5`). Boleh tukar di Tetapan.
- Jawapan yang sama di-cache 7 hari.
- Analisis iklan sekali sehari sahaja.
- Had bajet bulanan (default USD 10). Bila sampai, AI berhenti sampai bulan depan atau had dinaikkan.

## Akaun developer yang perlu disediakan

### 1. Meta (Facebook, Instagram, Meta Ads)

1. Buat app di <https://developers.facebook.com/apps> jenis **Business**.
2. Tambah produk: **Facebook Login for Business**, **Instagram Graph API**, **Marketing API**.
3. Valid OAuth Redirect URI: `https://ads.pibot.io/api/oauth/meta/callback`
4. Permission yang diminta: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`, `ads_management`, `ads_read`.
5. Untuk guna akaun sendiri, mode Development pun dah boleh (kau admin app). Untuk akaun orang lain atau Advanced Access, kena **Business Verification** dan **App Review**.
6. Salin App ID & App Secret ke `META_APP_ID` / `META_APP_SECRET`.

### 2. Threads

1. Dalam app Meta (atau app baru), tambah use case **Access the Threads API**.
2. Redirect URI: `https://ads.pibot.io/api/oauth/threads/callback`
3. Permission: `threads_basic`, `threads_content_publish`, `threads_manage_replies`.
4. Salin **Threads App ID** & **Threads App Secret** ke `THREADS_APP_ID` / `THREADS_APP_SECRET`.

### 3. TikTok (post)

1. Daftar di <https://developers.tiktok.com>, buat app, tambah **Login Kit** dan **Content Posting API** (aktifkan Direct Post).
2. Redirect URI: `https://ads.pibot.io/api/oauth/tiktok/callback`
3. Scope: `user.info.basic`, `video.publish`, `video.upload`.
4. Hantar app untuk **audit**. Sebelum lulus, biar `TIKTOK_PRIVACY_LEVEL=SELF_ONLY`. Lepas lulus tukar ke `PUBLIC_TO_EVERYONE`.
5. Untuk post gambar: sahkan domain `ads.pibot.io` di bahagian URL properties.

### 4. TikTok Ads

1. Daftar di <https://business-api.tiktok.com> (TikTok for Business Developers), buat app Marketing API. Semakan manual biasanya beberapa hari.
2. Redirect URL: `https://ads.pibot.io/api/oauth/tiktok-ads/callback`
3. Pilih scope untuk Campaign Management, Reporting, Creative/Assets, Audience.
4. Salin App ID & Secret ke `TIKTOK_ADS_APP_ID` / `TIKTOK_ADS_SECRET`.

### 5. AI (pilih satu atau lebih)

- Claude: <https://console.anthropic.com> → `ANTHROPIC_API_KEY`
- OpenAI: <https://platform.openai.com> → `OPENAI_API_KEY`, kemudian isi nama model di Tetapan AI.
- Meta Llama: <https://llama.developer.meta.com> → `LLAMA_API_KEY`

## Deploy di VPS

VPS dah ada caddy-gen di network Docker `root_default`, dan wildcard DNS `*.pibot.io` dah menghala ke VPS, jadi tak perlu ubah DNS atau proxy.

```bash
cd /opt
git clone https://github.com/MasterAzhari/pibot-ads.git
cd pibot-ads
cp .env.example .env
# isi .env: APP_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD, POSTGRES_PASSWORD, key platform & AI
docker compose up -d --build
docker compose logs -f app worker
```

Migration database berjalan sendiri bila container `app` start. Kemas kini: `git pull && docker compose up -d --build`.

Container: `app` (dashboard, port 3000 dalam network), `worker` (jadual post, sync iklan, analisis harian), `db` (Postgres 16, data dalam volume `db-data`). Media yang diupload disimpan dalam volume `uploads` dan dihidang di `/media/<nama-rawak>` supaya Meta & TikTok boleh tarik fail.

## Dev tempatan

```bash
npm install
cp .env.example .env   # set DATABASE_URL ke Postgres tempatan
npx prisma migrate deploy
npm run dev            # http://localhost:3000
npm run worker         # terminal lain
```

## Struktur

```
src/lib/platforms/   publish ke FB, IG, Threads, TikTok
src/lib/ads/         Meta Marketing API & TikTok Marketing API
src/lib/ai/          provider AI, had bajet, cache, prompt tugas
src/lib/jobs.ts      jadual post, sync iklan, analisis harian, laksana cadangan
worker/index.ts      loop latar belakang
src/app/             dashboard (Next.js App Router)
prisma/              skema & migration database
```
