import * as React from "react"

import { PARTICIPANTS } from "@/data/draft"
import { computeStandings, type Match } from "@/lib/scoring"
import {
  buildTeamRows, participantForm, tournamentTotals, isFinished,
} from "@/lib/derive"
import {
  fetchLiveOverrides, applyLiveOverrides, emptyOverlay, type LiveOverlay,
} from "@/lib/livescores"
import {
  StandingsPage, MatchDayPage, BracketPage, PairsPage,
  TeamsPage, StatsPage, RulesPage, AdminPage,
  type PageData,
} from "@/pages"
import { DankFx, playAirhorn, playOof } from "@/dank"

const POLL_MS = 60_000

interface MatchesFile {
  updatedAt?: string | null
  matches: Match[]
}

type RouteKey =
  | "standings" | "matches" | "bracket" | "pairs"
  | "teams" | "stats" | "rules" | "admin"

const TABS: { key: RouteKey; label: string; ico: string }[] = [
  { key: "standings", label: "Standings", ico: "🏆" },
  { key: "matches", label: "Match Day", ico: "⚽" },
  { key: "bracket", label: "Bracket", ico: "🗺️" },
  { key: "pairs", label: "Pairs", ico: "👥" },
  { key: "teams", label: "Teams", ico: "🌍" },
  { key: "stats", label: "Stats", ico: "📊" },
  { key: "rules", label: "Rules", ico: "📖" },
]

// old URLs (#/matchday, #/players/…) keep working
const ROUTE_ALIAS: Record<string, RouteKey> = {
  matchday: "matches", fixtures: "matches", players: "pairs",
}
const ROUTES = new Set<string>([...TABS.map((t) => t.key), "admin"])

function parseHash(): RouteKey | null {
  const seg = location.hash.replace(/^#\/?/, "").split("/")[0]
  if (ROUTE_ALIAS[seg]) return ROUTE_ALIAS[seg]
  return ROUTES.has(seg) ? (seg as RouteKey) : null
}

export default function App() {
  const [matches, setMatches] = React.useState<Match[]>([])
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [route, setRoute] = React.useState<RouteKey>(() =>
    parseHash() ?? (localStorage.getItem("ct-tab") as RouteKey | null) ?? "standings"
  )

  React.useEffect(() => {
    if (ROUTES.has(route)) localStorage.setItem("ct-tab", route)
    history.replaceState(null, "", `#${route}`)
  }, [route])

  React.useEffect(() => {
    const onHash = () => {
      const r = parseHash()
      if (r) { setRoute(r); window.scrollTo({ top: 0 }) }
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  // ── ULTRA MEGA DANK MODE (triple-click bottom-right corner) ──
  const [dank, setDank] = React.useState(() => localStorage.getItem("dank") === "1")
  const [dankBanner, setDankBanner] = React.useState(false)
  const clickTimes = React.useRef<number[]>([])

  React.useEffect(() => {
    document.body.classList.toggle("dank", dank)
    localStorage.setItem("dank", dank ? "1" : "0")
  }, [dank])

  const cornerClick = () => {
    const now = Date.now()
    clickTimes.current = [...clickTimes.current, now].filter((t) => now - t < 900)
    if (clickTimes.current.length >= 3) {
      clickTimes.current = []
      setDank((on) => {
        const next = !on
        if (next) { playAirhorn(); setDankBanner(true); setTimeout(() => setDankBanner(false), 1800) }
        else playOof()
        return next
      })
    }
  }

  // base fixtures (built JSON) and the ESPN live overlay are fetched
  // independently so either can fail without losing the other
  const baseRef = React.useRef<Match[]>([])
  const liveRef = React.useRef<LiveOverlay>(emptyOverlay())
  const inflight = React.useRef(false)

  const load = React.useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setLoading(true)
    try {
      try {
        const url = `${import.meta.env.BASE_URL}data/matches.json?t=${Date.now()}`
        const res = await fetch(url, { cache: "no-store" })
        const data: MatchesFile = await res.json()
        baseRef.current = data.matches ?? []
        setUpdatedAt(data.updatedAt ?? null)
      } catch {
        /* keep last good base data */
      }
      try {
        liveRef.current = {
          fetchedAt: Date.now(),
          map: await fetchLiveOverrides(liveRef.current.map),
        }
      } catch {
        /* keep last overlay; stale IN_PLAY entries stop applying after 15min */
      }
      setMatches(applyLiveOverrides(baseRef.current, liveRef.current))
    } finally {
      inflight.current = false
      setLoading(false)
    }
  }, [])

  // ticks each poll so time-based liveness (isMatchLive) re-evaluates even
  // when a fetch fails and `matches` keeps the same reference
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    load()
    const id = setInterval(() => { setNow(Date.now()); load() }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const data: PageData = React.useMemo(() => {
    const standings = computeStandings(matches)

    // movement vs the table as it stood before today's finished games
    const todayISO = new Date(now).toISOString().slice(0, 10)
    const prev = computeStandings(
      matches.filter((m) => !(isFinished(m) && (m.utcDate ?? "").slice(0, 10) >= todayISO))
    )
    const prevRank = Object.fromEntries(prev.map((s) => [s.participant.id, s.rank]))
    const mvByParticipant: Record<string, number> = {}
    for (const s of standings) {
      mvByParticipant[s.participant.id] = (prevRank[s.participant.id] ?? s.rank) - s.rank
    }

    const formByParticipant: Record<string, string> = {}
    for (const p of PARTICIPANTS) {
      formByParticipant[p.id] = participantForm(matches, p.teams)
    }
    return {
      matches,
      standings,
      teamRows: buildTeamRows(matches),
      totals: tournamentTotals(matches),
      formByParticipant,
      mvByParticipant,
      updatedAt,
      reload: load,
    }
  }, [matches, updatedAt, load, now])

  const liveCount = data.totals.live

  const PAGES: Record<RouteKey, React.ReactNode> = {
    standings: <StandingsPage d={data} />,
    matches: <MatchDayPage d={data} />,
    bracket: <BracketPage d={data} />,
    pairs: <PairsPage d={data} />,
    teams: <TeamsPage d={data} />,
    stats: <StatsPage d={data} />,
    rules: <RulesPage d={data} />,
    admin: <AdminPage d={data} />,
  }

  return (
    <>
      <div className="accentbar"><i /><i /><i /><i /><i /></div>

      <div className="wrap head">
        <header className="topbar">
          <a className="logo" href="#standings">
            <div className="ball">C</div>
            <div className="wm">CUP<span>TRACK</span></div>
          </a>
          <div className="spacer" />
          <span className="hostflags" title="Hosts: USA · Canada · Mexico">🇺🇸 🇨🇦 🇲🇽</span>
          {liveCount > 0 && (
            <span className="live-pill"><span className="pip" />{liveCount} LIVE</span>
          )}
          <button className="ghost-btn" onClick={load} disabled={loading}>
            {loading ? "↻ Updating…" : "↻ Refresh"}
          </button>
        </header>
      </div>

      <nav className="nav">
        <div className="nav-inner">
          {TABS.map((t) => (
            <a key={t.key} href={`#${t.key}`} className={`tab ${route === t.key ? "active" : ""}`}>
              <span className="ico">{t.ico}</span>
              {t.label}
              {t.key === "matches" && liveCount > 0 && <span className="badge">{liveCount}</span>}
            </a>
          ))}
        </div>
      </nav>

      <div className="wrap">
        <main>
          <section className="page" key={route}>{PAGES[route]}</section>
        </main>
      </div>

      {/* secret dank-mode trigger — triple-click me */}
      <div className="dank-corner" onClick={cornerClick} aria-hidden />
      {dank && <DankFx />}
      {dankBanner && <div className="dank-banner">420<br />DANK MODE<br />ENABLED</div>}
    </>
  )
}
