# Pibot Ads

Dashboard to auto-post, schedule, edit and manage ads on **Facebook, Instagram, Threads and TikTok**, with an AI assistant (Claude, OpenAI or Meta Llama) for captions, video scripts, audience suggestions and a daily review of ad performance.

Live: `https://ads.pibot.io` (Hostinger VPS, behind caddy-gen).

## Features

| Section | What it does |
| --- | --- |
| **Create post** | One caption + image/video to many accounts at once. Publish now, schedule (Malaysia time) or save as draft. AI suggests 3 captions + hashtags. |
| **Posts** | Status per platform, link to each post, retry failures, reschedule, edit caption, delete. |
| **Ads** | Meta & TikTok campaigns with spend, clicks, CTR, CPC and video views (7 days). Turn on/pause, change daily budget. |
| **New campaign** | Objective, budget, audience (countries, age, gender, interests, Advantage+), video/image creative, CTA. AI suggests the audience and looks up real interest IDs. Campaigns are always created **paused**. |
| **AI suggestions** | Every morning (8am MYT) the worker syncs ad data and asks the AI for pause / budget / info suggestions. **Nothing changes until you press Approve.** |
| **AI Studio** | Plan short 9:16 videos: 3-second hook, scene by scene, CTA, caption, tips. |
| **AI settings** | Provider for light & heavy tasks, models, fallback, model prices, monthly AI budget, language for customer-facing copy. |

The dashboard is in English. Captions, scripts and ad text are written in the language set under **Settings → Language for captions, scripts and ad text** (default: casual Bahasa Melayu).

### Platform limits (set by the APIs, not by this system)

| | Edit caption after posting | Delete via API | Notes |
| --- | --- | --- | --- |
| Facebook Page | ✓ | ✓ | |
| Instagram | ✗ | ✗ | Needs an image/video. Business/Creator account linked to a FB Page. |
| Threads | ✗ | ✓ | Text max 500 characters. |
| TikTok | ✗ | ✗ | Until the app passes the TikTok audit, posts are `SELF_ONLY` (private). Photo posts need `ads.pibot.io` verified in the TikTok portal. |

## Keeping AI costs low

- Calls Anthropic / OpenAI / Meta Llama **directly**. No OpenRouter or other middleman.
- Light tasks use a cheap model (default `claude-haiku-5-5`); heavy tasks (audience, analysis) use a stronger one (default `claude-opus-5-5`). Changeable in Settings.
- Identical requests are cached for 7 days.
- Ad analysis runs once a day.
- Monthly budget cap (default USD 10). Once reached, AI stops until next month or until you raise the cap.

## Developer accounts to set up

### 1. Meta (Facebook, Instagram, Meta Ads)

1. Create a **Business** app at <https://developers.facebook.com/apps>.
2. Add products: **Facebook Login for Business**, **Instagram Graph API**, **Marketing API**.
3. Valid OAuth Redirect URI: `https://ads.pibot.io/api/oauth/meta/callback`
4. Permissions requested: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`, `ads_management`, `ads_read`.
5. For your own accounts, Development mode is enough (you are the app admin). For other people's accounts or Advanced Access you need **Business Verification** and **App Review**.
6. Copy App ID & App Secret into `META_APP_ID` / `META_APP_SECRET`.

### 2. Threads

1. In the Meta app (or a new one), add the **Access the Threads API** use case.
2. Redirect URI: `https://ads.pibot.io/api/oauth/threads/callback`
3. Permissions: `threads_basic`, `threads_content_publish`, `threads_manage_replies`.
4. Copy the **Threads App ID** & **Threads App Secret** into `THREADS_APP_ID` / `THREADS_APP_SECRET`.

### 3. TikTok (posting)

1. Register at <https://developers.tiktok.com>, create an app, add **Login Kit** and **Content Posting API** (enable Direct Post).
2. Redirect URI: `https://ads.pibot.io/api/oauth/tiktok/callback`
3. Scopes: `user.info.basic`, `video.publish`, `video.upload`.
4. Submit the app for **audit**. Until approved keep `TIKTOK_PRIVACY_LEVEL=SELF_ONLY`; afterwards switch to `PUBLIC_TO_EVERYONE`.
5. For photo posts: verify the `ads.pibot.io` domain under URL properties.

### 4. TikTok Ads

1. Register at <https://business-api.tiktok.com> (TikTok for Business Developers) and create a Marketing API app. Manual review usually takes a few days.
2. Redirect URL: `https://ads.pibot.io/api/oauth/tiktok-ads/callback`
3. Choose scopes for Campaign Management, Reporting, Creative/Assets, Audience.
4. Copy App ID & Secret into `TIKTOK_ADS_APP_ID` / `TIKTOK_ADS_SECRET`.

### 5. AI (one or more)

- Claude: <https://console.anthropic.com> → `ANTHROPIC_API_KEY`
- OpenAI: <https://platform.openai.com> → `OPENAI_API_KEY`, then fill in model names under AI settings.
- Meta Llama: <https://llama.developer.meta.com> → `LLAMA_API_KEY`

## Deploy on the VPS

The VPS already runs caddy-gen on the Docker network `root_default`, and the wildcard DNS `*.pibot.io` already points at the VPS, so no DNS or proxy changes are needed.

```bash
cd /opt
git clone https://github.com/MasterAzhari/pibot-ads.git
cd pibot-ads
cp .env.example .env
# fill in .env: APP_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD, POSTGRES_PASSWORD, platform & AI keys
docker compose up -d --build
docker compose logs -f app worker
```

Database migrations run automatically when the `app` container starts. To update: `git pull && docker compose up -d --build`.

Containers: `app` (dashboard, port 3000 inside the network), `worker` (scheduled posts, ad sync, daily analysis), `db` (Postgres 16, data in the `db-data` volume). Uploaded media lives in the `uploads` volume and is served at `/media/<random-name>` so Meta and TikTok can fetch it.

## Local development

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres
npx prisma migrate deploy
npm run dev            # http://localhost:3000
npm run worker         # in another terminal
```

## Layout

```
src/lib/platforms/   publishing to FB, IG, Threads, TikTok
src/lib/ads/         Meta Marketing API & TikTok Marketing API
src/lib/ai/          AI providers, budget cap, cache, task prompts
src/lib/jobs.ts      scheduled posts, ad sync, daily analysis, applying suggestions
worker/index.ts      background loop
src/app/             dashboard (Next.js App Router)
prisma/              database schema & migrations
```
