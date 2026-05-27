# The In-Laws Are Coming - A Suburban RPG

A retro-inspired suburban JRPG where ordinary homeowner problems are treated with mythic seriousness.

The current vertical slice includes:

- Opening name entry for The Dad
- House, garage, and basement scenes
- Dialogue boxes with speaker labels and typewriter text
- A wrench hunt in the garage
- Basement encounters
- Evil Heating Coil boss fight
- Circuit breaker mechanics
- Local browser save data

See [docs/foundation.md](docs/foundation.md) for the core concept and scope rules.

## Development

Install dependencies:

```powershell
npm install
```

Run locally:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

Preview the production build:

```powershell
npm run preview
```

## Local Save Data

The game currently saves progress in browser `localStorage`.

To return to the opening name-entry screen, clear these keys for the local site:

```js
localStorage.removeItem("the-in-laws-are-coming-save");
localStorage.removeItem("suburban-jrpg-save");
location.reload();
```

## Deployment

This repository is intended to be the source of truth:

```text
pithed2/suburban-jrpg
```

Vercel should be connected directly to this GitHub repo and watch the `main` branch. The Vercel project/site can still be named `the-in-laws-are-coming`; the Vercel project name does not need to match the GitHub repo name.

Vercel settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`

The repo includes [vercel.json](vercel.json) with the build/output settings and a single-page app rewrite.

After Vercel is connected to `pithed2/suburban-jrpg`, every push to `main` should trigger a new deployment.
