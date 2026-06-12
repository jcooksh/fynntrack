// Sweepstake draft: each participant (a pair) owns six national teams.
// Source: "Copy of world cup for izzy.ods". Edit here to change ownership.

export interface Participant {
  id: string
  name: string
  teams: string[]
}

export const TOURNAMENT = {
  title: "World Cup 2026 Sweepstake",
  fromDate: "2026-06-11",
  toDate: "2026-07-19",
  host: "USA / CAN / MEX",
}

export const PARTICIPANTS: Participant[] = [
  { id: "fynn-izzy", name: "Fynn + Izzy", teams: ["Qatar", "Belgium", "Congo", "Iraq", "Senegal", "Cape Verde"] },
  { id: "arthur-jack", name: "Arthur + Jack", teams: ["Spain", "South Africa", "Uzbekistan", "USA", "Iran", "Ghana"] },
  { id: "harper-evie", name: "Harper + Evie", teams: ["England", "Australia", "Sweden", "Bosnia", "Colombia", "Haiti"] },
  { id: "joe-emilia", name: "Joe + Emilia", teams: ["Portugal", "Mexico", "Argentina", "Morocco", "Egypt", "Canada"] },
  { id: "finn-chloe", name: "Finn + Chloe", teams: ["Ivory Coast", "Paraguay", "Saudi Arabia", "Czech Republic", "Netherlands", "New Zealand"] },
  { id: "hari-charlotte", name: "Hari + Charlotte", teams: ["Uruguay", "Algeria", "Tunisia", "Japan", "Jordan", "Ecuador"] },
  { id: "ben-phoebe", name: "Ben + Phoebe", teams: ["Curaçao", "Switzerland", "Croatia", "Norway", "Brazil", "Austria"] },
  { id: "max-martha", name: "Max + Martha", teams: ["Germany", "France", "Turkey", "Scotland", "South Korea", "Panama"] },
]

// Map team name -> owning participant id (built once).
export const TEAM_OWNER: Record<string, string> = Object.fromEntries(
  PARTICIPANTS.flatMap((p) => p.teams.map((t) => [t, p.id]))
)

// Map team name -> owning participant display name.
export const TEAM_OWNER_NAME: Record<string, string> = Object.fromEntries(
  PARTICIPANTS.flatMap((p) => p.teams.map((t) => [t, p.name]))
)

export function ownerName(team: string): string | undefined {
  return TEAM_OWNER_NAME[team]
}
