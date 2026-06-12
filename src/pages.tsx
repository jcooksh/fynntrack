import { useState, type ReactNode } from "react"

import { PARTICIPANTS, TEAM_OWNER, TEAM_OWNER_NAME, TOURNAMENT } from "@/data/draft"
import { flagOf, initialsOf } from "@/data/flags"
import { pairColor } from "@/data/colors"
import { POINTS, finalWinner, type Match, type Standing } from "@/lib/scoring"
import {
  type TeamRow, type Totals, STAGE_LABEL, STAGE_SHORT, STAGE_RANK,
  isLive, isFinished, isUpcoming,
} from "@/lib/derive"

export interface PageData {
  matches: Match[]
  standings: Standing[]
  teamRows: TeamRow[]
  totals: Totals
  formByParticipant: Record<string, string>
  mvByParticipant: Record<string, number>
  updatedAt: string | null
  reload: () => void
}

/* ── shared helpers ─────────────────────────────────────────── */
const gdStr = (gd: number) => `${gd >= 0 ? "+" : ""}${gd}`
const firstName = (pair: string) => pair.split("+")[0].trim()
const ownerIdOf = (team: string): string | undefined => TEAM_OWNER[team]
const ownerFirst = (team: string) => {
  const nm = TEAM_OWNER_NAME[team]
  return nm ? firstName(nm) : undefined
}
const ownerColorOf = (team: string) => {
  const id = ownerIdOf(team)
  return id ? pairColor(id) : "transparent"
}

const TLA: Record<string, string> = {
  "South Korea": "KOR", "Saudi Arabia": "KSA", "South Africa": "RSA",
  "New Zealand": "NZL", "Czech Republic": "CZE", "Ivory Coast": "CIV",
  "Cape Verde": "CPV", USA: "USA", "Curaçao": "CUW",
}
const abbr = (t: string) => TLA[t] ?? t.slice(0, 3).toUpperCase()

const fmtDay = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "TBD"
const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "--:--"
const byDate = (a: Match, b: Match) => (a.utcDate ?? "").localeCompare(b.utcDate ?? "")

function MvTag({ mv }: { mv: number }) {
  if (mv > 0) return <span className="mv up">▲{mv}</span>
  if (mv < 0) return <span className="mv down">▼{-mv}</span>
  return <span className="mv same">–</span>
}

function FormPips({ form }: { form: string }) {
  if (!form) {
    return (
      <div className="form">
        {[0, 1, 2].map((i) => <span key={i} className="none">·</span>)}
      </div>
    )
  }
  return (
    <div className="form">
      {form.slice(-5).split("").map((c, i) => (
        <span key={i} className={c === "W" ? "w" : c === "D" ? "d" : "l"}>{c}</span>
      ))}
    </div>
  )
}

function OwnerDot({ team }: { team: string }) {
  return ownerIdOf(team)
    ? <span className="dotc" style={{ background: ownerColorOf(team) }} />
    : null
}

/* ════════ STANDINGS ════════ */
function NextUp({ matches }: { matches: Match[] }) {
  const next = matches.filter(isUpcoming).sort(byDate)[0]
  if (!next) return <div className="eyebrow">World Cup 2026 · Fynn's Sweepstake</div>
  const side = (t: string) => (
    <span className="nu-team">
      <span className="nu-fl">{flagOf(t)}</span>
      <span className="nu-tn">{t}</span>
      {ownerIdOf(t)
        ? <span className="nu-own"><OwnerDot team={t} /> {ownerFirst(t)}</span>
        : <span className="nu-own none">unpicked</span>}
    </span>
  )
  return (
    <div className="nextup">
      <div className="nu-lbl">
        <span className="nu-pip" />
        Next up · {fmtDay(next.utcDate)} · {fmtTime(next.utcDate)} kickoff
      </div>
      <div className="nu-fix">
        {side(next.homeTeam)}
        <span className="nu-v">v</span>
        {side(next.awayTeam)}
      </div>
    </div>
  )
}

function tickerItems(d: PageData): { text: ReactNode; key: string }[] {
  const live = d.matches.filter(isLive).filter((m) => m.homeScore != null || m.awayScore != null)
  const done = d.matches.filter(isFinished).sort((a, b) => byDate(b, a)).slice(0, 6)
  const items: { text: ReactNode; key: string }[] = []
  for (const m of live) {
    items.push({
      key: `l${m.id}`,
      text: <>
        {flagOf(m.homeTeam)} {abbr(m.homeTeam)} {m.homeScore ?? 0}–{m.awayScore ?? 0} {flagOf(m.awayTeam)} {abbr(m.awayTeam)} <b>· {m.minute ?? "LIVE"}</b>
      </>,
    })
  }
  for (const m of done) {
    if (m.homeScore == null || m.awayScore == null) continue
    let note: string
    if (m.homeScore > m.awayScore) note = `${ownerFirst(m.homeTeam) ?? abbr(m.homeTeam)} +${POINTS.win}`
    else if (m.homeScore < m.awayScore) note = `${ownerFirst(m.awayTeam) ?? abbr(m.awayTeam)} +${POINTS.win}`
    else {
      const a = ownerFirst(m.homeTeam), b = ownerFirst(m.awayTeam)
      note = a && b ? (a === b ? `${a} +${POINTS.draw * 2}` : `${a} & ${b} share`) : "points shared"
    }
    items.push({
      key: `f${m.id}`,
      text: <>
        {flagOf(m.homeTeam)} {abbr(m.homeTeam)} {m.homeScore}–{m.awayScore} {flagOf(m.awayTeam)} {abbr(m.awayTeam)} <b>· {note}</b>
      </>,
    })
  }
  if (items.length === 0) {
    const next = d.matches.filter(isUpcoming).sort(byDate)[0]
    items.push({
      key: "none",
      text: next
        ? <>No results yet — first kickoff {fmtDay(next.utcDate)} {fmtTime(next.utcDate)}</>
        : <>No matches loaded</>,
    })
  }
  return items
}

export function StandingsPage({ d }: { d: PageData }) {
  const { standings, totals, formByParticipant, mvByParticipant } = d
  const podClass = ["gold", "teal", "coral"]
  const podWord = ["First place 👑", "Runner-up", "Third"]

  const dayNo = Math.max(1, Math.floor((Date.now() - Date.parse(TOURNAMENT.fromDate)) / 864e5) + 1)
  const daysToFinal = Math.max(0, Math.ceil((Date.parse(TOURNAMENT.toDate) - Date.now()) / 864e5))
  const nextMatch = d.matches.filter(isUpcoming).sort(byDate)[0]
  const stageLbl = nextMatch ? STAGE_LABEL[nextMatch.stage] ?? "Tournament" : "Tournament"

  const items = tickerItems(d)
  const run = items.map((it, i) => (
    <span key={it.key}>{it.text}{i < items.length - 1 && <span className="dot">◆</span>}</span>
  ))

  return (
    <>
      <section className="hero">
        <div><NextUp matches={d.matches} /></div>
        <div className="countdown">
          <div className="lbl">{stageLbl} · Day {dayNo}</div>
          <div className="big">{daysToFinal} days</div>
          <div className="lbl" style={{ marginTop: 4 }}>until the final</div>
        </div>
      </section>

      <div className="ticker">
        <span className="tag">{totals.live > 0 ? "LIVE" : "LATEST"}</span>
        <div className="scroll">
          <span className="run">{run}<span className="dot">◆</span>{run}<span className="dot">◆</span></span>
        </div>
      </div>

      <div className="section-head">
        <h2>On the podium</h2><div className="spacer" />
        <span className="eyebrow">Top 3 of {standings.length}</span>
      </div>
      <div className="podium">
        {standings.slice(0, 3).map((s, i) => (
          <div key={s.participant.id} className={`pod ${podClass[i]}`}>
            <div className="rk-badge">{i + 1}</div>
            <div className="rk-word">{podWord[i]}</div>
            <div className="nm">{s.participant.name}</div>
            <div className="flags">
              {s.participant.teams.map((t) => <span key={t} className="f">{flagOf(t)}</span>)}
            </div>
            <div className="pts">{s.points}<span className="u">pts</span></div>
            <div className="meta">GD {gdStr(s.gd)} · last 5 {formByParticipant[s.participant.id] || "—"}</div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Full table</h2><div className="spacer" />
        <span className="eyebrow">Tap a pair · GD tie-break</span>
      </div>
      <div className="board">
        <div className="head">
          <span>#</span><span>Pair</span><span>Teams</span><span>Form</span>
          <span className="r">GD</span><span className="r">Pts</span>
        </div>
        {standings.map((s, i) => {
          const p = s.participant
          return (
            <a key={p.id} href="#pairs" className={`row ${i === 0 ? "leader" : ""}`}>
              <div className="rk"><span className="pos">{i + 1}</span><MvTag mv={mvByParticipant[p.id] ?? 0} /></div>
              <div className="who">
                <div className="ava" style={{ background: pairColor(p.id) }}>{initialsOf(p.name)}</div>
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="sub">{s.won}W {s.drawn}D {s.lost}L</div>
                </div>
              </div>
              <div className="flagcluster">
                {p.teams.map((t) => <span key={t} className="f">{flagOf(t)}</span>)}
              </div>
              <FormPips form={formByParticipant[p.id] ?? ""} />
              <div className={`gd num ${s.gd > 0 ? "pos" : s.gd < 0 ? "neg" : ""}`}>{gdStr(s.gd)}</div>
              <div className="pts-cell num">{s.points}</div>
            </a>
          )
        })}
      </div>
      <div className="footnote">
        <span className="chip">WIN +{POINTS.win}</span>
        <span className="chip">DRAW +{POINTS.draw}</span>
        <span className="chip">KO ROUND +{POINTS.nextRound}</span>
        <span className="chip">CHAMPIONS +{POINTS.champion}</span>
        Draw a team that goes out early? You keep the points. No swaps, no refunds — and everyone
        still has to get a team outfit. 🎽
      </div>
    </>
  )
}

/* ════════ MATCH DAY ════════ */
function MatchCard({ m }: { m: Match }) {
  const live = isLive(m), ft = isFinished(m)
  const started = (ft || live) && (m.homeScore != null || m.awayScore != null)
  const stat = live
    ? <span className="stat live"><span className="pip" />{m.minute ?? "LIVE"}</span>
    : ft
      ? <span className="stat ft">FULL TIME</span>
      : <span className="stat soon">{fmtTime(m.utcDate)}</span>

  const side = (team: string, score: number | null, other: number | null) => {
    const dim = started && score != null && other != null && score < other
    return (
      <div className={`side ${dim ? "dim" : ""}`}>
        <span className="fl">{flagOf(team)}</span>
        <div>
          <span className="tn">{team}</span>
          {ownerIdOf(team) && (
            <div className="ownline"><OwnerDot team={team} /> {ownerFirst(team)}</div>
          )}
        </div>
        <span className="sc">{started ? score ?? 0 : ""}</span>
      </div>
    )
  }
  return (
    <div className={`match ${live ? "islive" : ""}`}>
      <div className="mh"><span className="when">{fmtDay(m.utcDate)}</span>{stat}</div>
      {side(m.homeTeam, m.homeScore, m.awayScore)}
      {!started && <div className="vs">vs</div>}
      {side(m.awayTeam, m.awayScore, m.homeScore)}
    </div>
  )
}

function dayGroups(ms: Match[]): [string, Match[]][] {
  const groups: Record<string, Match[]> = {}
  const order: string[] = []
  for (const m of ms) {
    const key = fmtDay(m.utcDate)
    if (!groups[key]) { groups[key] = []; order.push(key) }
    groups[key].push(m)
  }
  return order.map((k) => [k, groups[k]])
}

export function MatchDayPage({ d }: { d: PageData }) {
  const live = d.matches.filter(isLive).sort(byDate)
  const done = d.matches.filter(isFinished).sort((a, b) => byDate(b, a))
  const soon = d.matches.filter(isUpcoming).sort(byDate)

  return (
    <>
      <div className="section-head">
        <h2>Match Day</h2><div className="spacer" />
        <span className="eyebrow">{live.length} live · {done.length} done · {soon.length} to come</span>
      </div>

      {live.length > 0 && (
        <>
          <div className="dayhdr" style={{ marginTop: 6 }}>🔴 Live now</div>
          <div className="match-grid">{live.map((m) => <MatchCard key={m.id} m={m} />)}</div>
        </>
      )}

      <div className="section-head mt"><h2>Results</h2></div>
      {done.length
        ? dayGroups(done).map(([day, ms]) => (
          <div key={day}>
            <div className="dayhdr">{day}</div>
            <div className="match-grid">{ms.map((m) => <MatchCard key={m.id} m={m} />)}</div>
          </div>
        ))
        : <div className="empty">No results yet — tournament runs {TOURNAMENT.fromDate} → {TOURNAMENT.toDate}</div>}

      <div className="section-head mt"><h2>Coming up</h2></div>
      {soon.length
        ? dayGroups(soon).map(([day, ms]) => (
          <div key={day}>
            <div className="dayhdr">{day}</div>
            <div className="match-grid">{ms.map((m) => <MatchCard key={m.id} m={m} />)}</div>
          </div>
        ))
        : <div className="empty">No upcoming fixtures</div>}
    </>
  )
}

/* ════════ BRACKET ════════ */
const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"]

function Tie({ m }: { m: Match }) {
  // explicit winner first — a tie decided on pens finishes with level scores
  const hw = m.winner === "HOME" ||
    (m.winner == null && m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore)
  const aw = m.winner === "AWAY" ||
    (m.winner == null && m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore)
  const live = isLive(m)
  const t = (team: string, win: boolean, score: number | null) => (
    <div className={`t ${win && isFinished(m) ? "win" : ""}`}>
      <span className="fl">{flagOf(team)}</span>
      <span className="tn">{team}</span>
      <span className="sc num">{score ?? ""}</span>
      <span className="od" style={{ background: ownerColorOf(team) }} />
    </div>
  )
  return (
    <div className={`tie ${m.stage === "FINAL" ? "final" : ""} ${live ? "islive" : ""}`}>
      {t(m.homeTeam, hw, m.homeScore)}
      {t(m.awayTeam, aw, m.awayScore)}
      {live && <div className="tfoot live">● live{m.minute ? ` · ${m.minute}` : ""}</div>}
      {isUpcoming(m) && <div className="tfoot">{fmtDay(m.utcDate)} · {fmtTime(m.utcDate)}</div>}
    </div>
  )
}

export function BracketPage({ d }: { d: PageData }) {
  const ko = d.matches.filter((m) => (STAGE_RANK[m.stage] ?? 0) > 0 && m.stage !== "THIRD_PLACE")
  const champ = finalWinner(d.matches)

  return (
    <>
      <div className="section-head">
        <h2>The Bracket</h2><div className="spacer" />
        <span className="eyebrow">R32 → Final · +{POINTS.nextRound} per round reached</span>
      </div>

      {ko.length === 0 ? (
        <div className="empty">
          Bracket is set after the group stage — check back once the Round of 32 is drawn
        </div>
      ) : (
        <div className="bracket">
          {KO_STAGES.map((stage) => {
            const ties = ko.filter((m) => m.stage === stage).sort(byDate)
            return (
              <div className="bcol" key={stage}>
                <div className="bcol-h">{STAGE_LABEL[stage] ?? stage}</div>
                <div className="bcol-body">
                  {ties.length
                    ? ties.map((m) => <Tie key={m.id} m={m} />)
                    : <div className="tie"><div className="t"><span className="tn" style={{ color: "var(--ink-3)" }}>TBD</span></div></div>}
                  {stage === "FINAL" && champ && (
                    <div className="champ">
                      <div className="lbl">World champions</div>
                      <div className="fl">{flagOf(champ)}</div>
                      <div className="tn">{champ}</div>
                      <div className="lbl" style={{ marginTop: 6 }}>{ownerFirst(champ) ?? "—"} cashes in 🏆</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="footnote bracket-note">
        <span className="chip">Live data</span>
        Reaching each knockout round is <b>+{POINTS.nextRound}</b> for the owning pair, and lifting
        the cup is another <b>+{POINTS.champion}</b> — so the bracket is where the table can flip.
        Coloured dots show who owns each nation.
      </div>
    </>
  )
}

/* ════════ PAIRS ════════ */
export function PairsPage({ d }: { d: PageData }) {
  const rowByTeam = Object.fromEntries(d.teamRows.map((t) => [t.team, t]))
  return (
    <>
      <div className="section-head">
        <h2>The Pairs</h2><div className="spacer" />
        <span className="eyebrow">{PARTICIPANTS.length} teams · 6 nations each</span>
      </div>
      <div className="pairs-grid">
        {d.standings.map((s, i) => {
          const p = s.participant
          return (
            <div key={p.id} className="pcard" id={`pair-${p.id}`}>
              <div className="top" style={{ background: pairColor(p.id) }}>
                <div className="ava">{initialsOf(p.name)}</div>
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="sub">RANK #{i + 1} · {s.won}W {s.drawn}D {s.lost}L · GD {gdStr(s.gd)}</div>
                </div>
                <div className="big"><div className="n">{s.points}</div><div className="u">POINTS</div></div>
              </div>
              <div className="body">
                {s.teams.map((t) => {
                  const row = rowByTeam[t.team]
                  const form = (row?.form ?? []).filter((c) => c !== "live").slice(-4)
                  return (
                    <div key={t.team} className="teamrow">
                      <span className="fl">{flagOf(t.team)}</span>
                      <span className="tn">{t.team}</span>
                      <span className="mini">
                        {form.map((c, j) => (
                          <span key={j} className={c === "W" ? "w" : c === "D" ? "d" : "l"}>{c}</span>
                        ))}
                      </span>
                      <span className={`tp ${row?.live ? "live" : ""}`}>
                        {t.points} pt{t.points === 1 ? "" : "s"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ════════ TEAMS ════════ */
export function TeamsPage({ d }: { d: PageData }) {
  const [filter, setFilter] = useState("all")
  const sorted = [...d.teamRows].sort((a, b) => b.points - a.points || a.team.localeCompare(b.team))
  const shown = filter === "all" ? sorted : sorted.filter((t) => ownerIdOf(t.team) === filter)

  return (
    <>
      <div className="section-head">
        <h2>The Teams</h2><div className="spacer" />
        <span className="eyebrow">{d.teamRows.length} nations · points contributed</span>
      </div>
      <div className="filterbar">
        <button className={`fbtn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All {d.teamRows.length}
        </button>
        {PARTICIPANTS.map((p) => (
          <button
            key={p.id}
            className={`fbtn ${filter === p.id ? "active" : ""}`}
            onClick={() => setFilter(p.id)}
          >
            <span className="dotc" style={{ background: pairColor(p.id) }} />
            {firstName(p.name)}
          </button>
        ))}
      </div>
      <div className="teams-grid">
        {shown.map((t) => (
          <div key={t.team} className="tcard">
            <span className="stripe" style={{ background: ownerColorOf(t.team) }} />
            {t.live && <span className="livedot" />}
            <span className="fl">{flagOf(t.team)}</span>
            <div className="info">
              <div className="tn">{t.team}</div>
              <div className="ow">{STAGE_SHORT[t.stage] ?? t.stage} · {ownerFirst(t.team) ?? "—"}</div>
            </div>
            <div className="pp">{t.points}<small>PTS</small></div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ════════ STATS ════════ */
export function StatsPage({ d }: { d: PageData }) {
  const { standings, teamRows, totals, mvByParticipant } = d
  const leader = standings[0]
  const last = standings[standings.length - 1]
  const mover = [...standings].sort(
    (a, b) => (mvByParticipant[b.participant.id] ?? 0) - (mvByParticipant[a.participant.id] ?? 0)
  )[0]
  const moverMv = mvByParticipant[mover?.participant.id] ?? 0
  const bestPick = [...teamRows].sort((a, b) => b.points - a.points)[0]
  const maxPts = Math.max(1, leader?.points ?? 0)
  const dayNo = Math.max(1, Math.floor((Date.now() - Date.parse(TOURNAMENT.fromDate)) / 864e5) + 1)

  return (
    <>
      <div className="section-head">
        <h2>The Stats</h2><div className="spacer" />
        <span className="eyebrow">Day {dayNo} · for the group chat</span>
      </div>
      <div className="stat-grid">
        <div className="scard gold">
          <span className="em">👑</span>
          <div className="k">Top of the pile</div>
          <div className="v">{leader ? firstName(leader.participant.name) : "—"}</div>
          <div className="d">{leader?.points ?? 0} pts · {leader?.won ?? 0} wins · GD {gdStr(leader?.gd ?? 0)}</div>
        </div>
        <div className="scard teal">
          <span className="em">📈</span>
          <div className="k">Biggest climber</div>
          <div className="v">{moverMv > 0 ? firstName(mover.participant.name) : "—"}</div>
          <div className="d">{moverMv > 0 ? `Up ${moverMv} place${moverMv === 1 ? "" : "s"} since yesterday` : "No movement yet"}</div>
        </div>
        <div className="scard coral">
          <span className="em">🥶</span>
          <div className="k">Rock bottom</div>
          <div className="v">{last ? firstName(last.participant.name) : "—"}</div>
          <div className="d">
            {last?.points ?? 0} pts
            {last?.participant.id === "fynn-izzy" ? " — it's literally your sweepstake, Fynn" : " — outfit money well spent"}
          </div>
        </div>
        <div className="scard ink">
          <span className="em">{bestPick ? flagOf(bestPick.team) : "⚽"}</span>
          <div className="k">Best pick so far</div>
          <div className="v">{bestPick?.team ?? "—"}</div>
          <div className="d">{bestPick?.points ?? 0} pts for {bestPick ? ownerFirst(bestPick.team) : "—"} &amp; co</div>
        </div>
        <div className="scard cream">
          <span className="em">⚽</span>
          <div className="k">Goals so far</div>
          <div className="v">{totals.goals}</div>
          <div className="d">across {totals.finished} finished game{totals.finished === 1 ? "" : "s"}{totals.live ? ` + ${totals.live} live` : ""}</div>
        </div>
        <div className="scard cream">
          <span className="em">🎽</span>
          <div className="k">Owe an outfit</div>
          <div className="v">{PARTICIPANTS.length} / {PARTICIPANTS.length}</div>
          <div className="d">Nobody's bought the kit yet. Classic.</div>
        </div>
      </div>

      <div className="section-head"><h2>Points by pair</h2></div>
      <div className="barlist">
        {standings.map((s) => (
          <div key={s.participant.id} className="barrow">
            <span className="bn">{s.participant.name}</span>
            <div className="bartrack">
              <div
                className="barfill"
                style={{ width: `${Math.round((s.points / maxPts) * 100)}%`, background: pairColor(s.participant.id) }}
              />
            </div>
            <span className="bv">{s.points}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ════════ RULES ════════ */
export function RulesPage(_: { d: PageData }) {
  return (
    <>
      <div className="section-head">
        <h2>How it works</h2><div className="spacer" />
        <span className="eyebrow">The sweepstake rules</span>
      </div>
      <div className="rules-grid">
        <div className="rule-card">
          <h3>Scoring</h3>
          <div className="score-line">
            <div className="ic" style={{ background: "rgba(7,160,133,.14)" }}>✅</div>
            <div className="lab">Win<small>any of your teams wins a match</small></div>
            <div className="pl pos">+{POINTS.win}</div>
          </div>
          <div className="score-line">
            <div className="ic" style={{ background: "rgba(255,176,46,.18)" }}>🤝</div>
            <div className="lab">Draw<small>a point for a stalemate</small></div>
            <div className="pl pos">+{POINTS.draw}</div>
          </div>
          <div className="score-line">
            <div className="ic" style={{ background: "rgba(46,91,255,.12)" }}>🚀</div>
            <div className="lab">Reach a knockout round<small>R32, R16, QF, SF, Final — each step</small></div>
            <div className="pl pos">+{POINTS.nextRound}</div>
          </div>
          <div className="score-line">
            <div className="ic" style={{ background: "rgba(255,176,46,.22)" }}>🏆</div>
            <div className="lab">Win the World Cup<small>your team lifts the trophy</small></div>
            <div className="pl pos">+{POINTS.champion}</div>
          </div>
        </div>
        <div>
          <div className="rule-card">
            <h3>Tie-breaks</h3>
            <div className="tiebreak"><span className="n">1</span><div><b>Goal difference</b> across all your teams</div></div>
            <div className="tiebreak"><span className="n">2</span><div><b>Goals scored</b> — attack wins the day</div></div>
            <div className="tiebreak"><span className="n">3</span><div><b>Alphabetical</b> on pair name. Sudden death.</div></div>
          </div>
        </div>
      </div>
      <div className="footnote" style={{ marginTop: 24 }}>
        <span className="chip">{PARTICIPANTS.length} pairs</span>
        <span className="chip">48 nations</span>
        <span className="chip">6 each</span>
        Drafted blind from "Copy of world cup for izzy". No swaps, no refunds, no mercy.
      </div>
    </>
  )
}

/* ════════ ADMIN (hidden route — #admin) ════════ */
export function AdminPage({ d }: { d: PageData }) {
  const { updatedAt, reload, totals, matches } = d
  const lastSync = updatedAt ? new Date(updatedAt).toLocaleString() : "never"
  const dataUrl = `${import.meta.env.BASE_URL}data/matches.json`

  return (
    <>
      <div className="section-head">
        <h2>Admin</h2><div className="spacer" />
        <span className="eyebrow">draft · data · sync</span>
      </div>
      <div className="rules-grid">
        <div className="rule-card">
          <h3>The draft</h3>
          {PARTICIPANTS.map((p) => (
            <div key={p.id} className="adminrow">
              <div className="ava" style={{ background: pairColor(p.id) }}>{initialsOf(p.name)}</div>
              <div className="nm">{p.name}</div>
              <div className="chips">
                {p.teams.map((t) => <span key={t} className="chip">{flagOf(t)} {t}</span>)}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-3)" }}>
            Edit the draft in <code>src/data/draft.ts</code> and push to update.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="rule-card">
            <h3>Data</h3>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 12 }}>
              Last sync <b>{lastSync}</b> · {matches.length} matches loaded ·{" "}
              {totals.played} played · {totals.upcoming} upcoming · auto every ~10 min on match days.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="ghost-btn" onClick={reload}>⟳ Reload scores now</button>
              <a className="ghost-btn" href={dataUrl} download>↓ Download matches.json</a>
            </div>
          </div>
          <div className="rule-card">
            <h3>API key</h3>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
              <code>FOOTBALL_DATA_KEY</code> is stored as a GitHub repo secret and used only by the
              CI fetch job. It never reaches the browser.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
