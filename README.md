<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=160&section=header&text=client-twitch&fontSize=42&fontColor=fff&animation=fadeIn&fontAlignY=38&desc=ElisaOS%20Experimental%20Twitch%20Client&descAlignY=60&descSize=14" width="100%"/>

<img src="https://skillicons.dev/icons?i=ts,nodejs&theme=dark" alt="Tech stack"/>

</div>

 Drop‑in `README.md`

```markdown
# AIR³ Relay Bot

> *Scrape YouTube & X live chats · Relay to Twitch · Minimal dashboard*

<table>
<tr><td><b>Language</b></td><td>TypeScript (ES2022 / ESM)</td></tr>
<tr><td><b>Runtime</b></td><td>Node 22 + PNPM 10</td></tr>
<tr><td><b>Major deps</b></td><td>Playwright · youtube‑chat · Socket.IO · zod · Express</td></tr>
</table>

---

## ✨ Features

* **Dual listeners** – YouTube Live & X (Twitter) chat via Playwright.
* **Two Twitch bots** – separate OAuth credentials for messages coming from YT and X.
* **Rate‑limiter** – max 1 msg / 1.4 s per bot → never hits Twitch 20 msg / 30 s cap.
* **Queue ageing** – messages older than 10 s are discarded on restart (no backlog spam).
* **Self‑healing** – X listener retries every 60 s if chat is offline.
* **Dashboard** – static SPA served at `http://localhost:7666`, streams last 50 log lines.
* **Secrets‑safe** – `chatbot.json` is *ignored* by Git; sample file supplied.

---

## 📦 Folder layout

```

AIR3botwich/
├─ src/
│  ├─ index.ts            # Orchestrator (main runtime)
│  ├─ utils/              # Twitch / YouTube / X helpers, relayQueue, …
│  └─ web/
│     ├─ server.ts        # Express + Socket.IO dashboard backend
│     └─ public/          # Static SPA assets (index.html, css, js)
├─ dist/                  # Built JS (tsup) – *generated*
├─ .gitignore
├─ chatbot.sample.json    # Template – copy to chatbot.json and fill secrets
├─ pnpm-lock.yaml
└─ tsconfig.json

````

---

## 🚀 Quick start

```bash
# 1. clone & install
git clone https://github.com/YOU/air3botwich.git
cd air3botwich
pnpm install          # installs deps + downloads Playwright chromium

# 2. configure secrets
cp chatbot.sample.json chatbot.json
#   ↳ fill in Twitch client‑IDs, refresh‑tokens, X cookies, …

# 3. build & run
pnpm run build        # compiles TypeScript → dist/
pnpm run dev          # starts bot + dashboard (watch mode)
#   ‑ or ‑
pnpm run all          # full pipeline: install → build → dev
````

Dashboard: **[http://localhost:7666](http://localhost:7666)**

---

## 🔧 Scripts

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm run build` | `tsup` → bundles `src/` to ESM code in `dist/`         |
| `pnpm run bot`   | Runs `node dist/index.js` only (headless)              |
| `pnpm run dash`  | Runs dashboard backend (`tsx src/web/server.ts`)       |
| `pnpm run dev`   | Concurrent bot **and** dashboard                       |
| `pnpm run all`   | `setup` → `build` → `dev` (one‑liner for fresh clones) |
| `pnpm run clean` | Removes `dist/`                                        |

`postinstall` automatically downloads Playwright’s browser binaries.

---

## 🗝️ Environment / secrets

It’s recommended to replace raw secrets inside `chatbot.json` with **dotenv** variables:

```bash
pnpm add dotenv
```

```ts
import "dotenv/config";
const clientId = process.env.TWITCH_YT_CLIENT_ID!;
```

Then keep your real `.env` out of Git (`.gitignore`) and commit a `.env.sample`.

---

## 🛠️ Development notes

* **Node 22 ESM** – no `require()`; use `import`.
* **`relayQueue`** is SPS‑C (single‑producer single‑consumer); don’t await inside enqueue.
* **YouTube 503**: the wrapper waits 5 s and retries automatically (see `youtubeAuth.ts`).

---

## 📝 Licence

MIT © 2025 *Your Name / AIR³ Labs*

