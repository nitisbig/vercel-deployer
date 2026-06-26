# Deployer Agent

Deploy any Vercel-compatible website (HTML, React, Next.js, Svelte, Astro, Vite, etc.)
from a simple UI in a few clicks.

**Flow:** Connect your Vercel account → upload/select your project folder → click **Deploy** → get a live URL.

> MVP scope: **Vercel** is the only deployment target. The UI is built so other
> providers (GitHub Pages, Cloudflare, AWS, Azure, GCP, Hostinger) can be added later.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev
```

Open http://localhost:3000.

## Connecting Vercel — two options

### Option A — One-click OAuth (recommended)

1. Create an integration: https://vercel.com/dashboard/integrations/create
2. Set the **Redirect URL** to `http://localhost:3000/api/auth/callback`.
3. Copy the **Client ID** and **Client Secret** into `.env.local`:

   ```
   VERCEL_CLIENT_ID=...
   VERCEL_CLIENT_SECRET=...
   APP_URL=http://localhost:3000
   ```

4. Restart the dev server and click **Connect Vercel**.

### Option B — Access token (fastest for testing)

No integration setup needed. Create a token at
https://vercel.com/account/settings/tokens, then paste it into the
"Use an access token instead" field on the home page.

## How a deploy works

1. The browser sends your project files (skipping `node_modules`, `.git`,
   `.next`, build output) to `/api/deploy`.
2. The server hashes each file (SHA1) and uploads them to the Vercel Files API.
3. It creates a deployment via `POST /v13/deployments`, auto-detecting the
   framework from `package.json`.
4. The UI polls deployment status until it is **READY** and shows the live URL.

## Project structure

```
app/
  page.tsx                 # 3-step UI: connect → upload → deploy
  api/auth/login           # start OAuth
  api/auth/callback        # finish OAuth, set session
  api/auth/token           # connect via pasted access token
  api/auth/logout          # clear session
  api/me                   # current connection status
  api/deploy               # upload files + create deployment
  api/deploy/status        # poll a deployment's state
lib/vercel.ts              # Vercel API client + framework detection
lib/session.ts             # signed cookie session helpers
```
