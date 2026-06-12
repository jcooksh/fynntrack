// One vivid colour per pair (from the CupTrack design palette).
const PALETTE = {
  coral: "#FF4E36", teal: "#07A085", gold: "#FFB02E", blue: "#2E5BFF",
  pink: "#F25C8E", plum: "#7A5BFF", lime: "#5C9A00", sky: "#1592C9",
}

export const PAIR_COLOR: Record<string, string> = {
  "joe-emilia": PALETTE.blue,
  "ben-phoebe": PALETTE.coral,
  "max-martha": PALETTE.teal,
  "arthur-jack": PALETTE.pink,
  "harper-evie": PALETTE.gold,
  "finn-chloe": PALETTE.sky,
  "hari-charlotte": PALETTE.plum,
  "fynn-izzy": PALETTE.lime,
}

export const pairColor = (participantId: string) =>
  PAIR_COLOR[participantId] ?? "#928876"
