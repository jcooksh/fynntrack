# Fynn's World Cup 2026 Sweepstake Tracker

**🔗 Live: https://jcooksh.github.io/fynntrack/**

Live leaderboard for a World Cup sweepstake. Eight pairs each own six national
teams; the app pulls real match results and ranks everyone by points.

## Scoring

| Event | Points |
| --- | --- |
| Win | **3** |
| Draw | **1** |
| Loss | 0 |
| Reaching a knockout round (R32, R16, QF, SF, Final) | **4** per round |
| Winning the World Cup | **4** |

The third-place match earns nothing extra. **Goal difference** (goals for −
goals against, summed across a pair's teams) is the first tie-break, then
goals for.

And everyone has to get a team outfit.

## Stack

- Vite + React 19 + TypeScript
- [football-data.org](https://www.football-data.org) for fixtures, stages and
  baseline results (fetched in CI — free tier)
- ESPN's public scoreboard JSON for live in-browser score/status overrides

## How live scores work

football-data.org blocks browser CORS, so the browser can't call it directly.
A GitHub Action (`.github/workflows/deploy.yml`) runs on a ~10-minute cron,
fetches matches with the API key (stored as a repo **secret**), writes
`public/data/matches.json`, rebuilds, and redeploys to GitHub Pages. The
front-end reads that static JSON and re-polls it every 60s, then overlays live
status/scores from ESPN's keyless scoreboard endpoint on every poll (the
free football-data tier can lag live results by hours).

## Setup

```bash
npm install
npm run dev        # local dev at http://localhost:5173
```

### Live data locally (optional)

```bash
cp .env.example .env       # add your football-data.org key
export FOOTBALL_DATA_KEY=xxxx
npm run fetch-scores       # writes public/data/matches.json
```

### Deploy (GitHub Pages)

1. Repo **Settings → Secrets and variables → Actions** → add `FOOTBALL_DATA_KEY`.
2. Repo **Settings → Pages** → Source: **GitHub Actions**.
3. Push to `main`. The workflow builds, deploys, and keeps scores fresh on cron.

## Editing the draft

Participants and their teams live in `src/data/draft.ts`. If the API spells a
country differently (e.g. `Korea Republic`), add an alias in
`src/data/aliases.ts`.
