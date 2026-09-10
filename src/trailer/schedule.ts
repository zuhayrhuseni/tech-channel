// Keyword frames, derived from episodes/000-trailer/timing.json captions
// (30fps). Regenerate after any re-record — a stale frame here is a sync
// bug. Words the ASR mangled ("hiring", "precise", "unsettled", "start")
// carry their provenance in comments.
export const K = {
  // hook (beat 0–360)
  explanations: 42,
  stop: 91,
  layerAbove: 99,
  faster: 225, // mark: hook/faster
  slower: 263,
  planner: 289,
  // what (360–570)
  layerDown: 411,
  databases: 424,
  distributed: 451,
  networking: 470,
  // industry (570–902)
  industry: 642,
  hiring: 660, // ASR split "H iring"; midpoint industry@642..layoffs@677
  layoffs: 677,
  data: 712,
  headlines: 751,
  honest: 822,
  contested: 868,
  // career (902–1050)
  gettingIn: 914,
  harder: 947,
  precise: 1007, // mark: career/precise (positionally inferred)
  // promise (1050–1320)
  publicSources: 1092,
  description: 1141,
  unsettled: 1212, // ASR split "unsett led" @40.4s
  sayso: 1245,
  // close (1320–1489)
  video: 1327,
  weeks: 1362,
  anywhere: 1385, // "start" heard as "store" @45.8s; anchored on "anywhere"
} as const;

export const BEATS = {
  hook: 0,
  what: 360,
  industry: 570,
  career: 902,
  promise: 1050,
  close: 1320,
  end: 1489,
} as const;
