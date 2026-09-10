/**
 * Barrel for episode 005's per-beat scenes.
 *
 * Every scene in this folder shares one contract: it takes `p`, a
 * `Partial<Record<Step, number>>` of 0..1 progresses keyed by the step names in
 * that beat's `build:` list in script.yaml, plus an optional absolute `frame`
 * used ONLY for periodic idle motion (drift, caret blink, pulse). Nothing in a
 * scene reads the clock to decide WHEN something appears — that decision lives
 * in `Episode005.tsx`, driven by timing.json marks.
 *
 * The `_STEPS` arrays are exported alongside the components because they are
 * the build order, verbatim from script.yaml, and both the episode driver and
 * `Lab.tsx` iterate them rather than re-typing the names. A typo'd step name is
 * otherwise silent: `p.byte_grd` is just `undefined`, which is 0, which is "not
 * started" — the element simply never appears and nothing errors.
 *
 * NOT exported here: `DrepperChart` (beat 9) and `RatioMorph` (beat 10). They
 * live in `src/components/` because beat 10 MORPHS beat 9's bars through the
 * shared geometry in `components/chartGeom.ts`, and that handoff is a
 * component-library concern, not an ep005-scene one. Import those two from
 * `../../components`.
 */

export { HookRace, HOOK_RACE_STEPS } from "./HookRace";
export type { HookRaceProps, HookRaceStep } from "./HookRace";

export { WhiteboardWorld, WHITEBOARD_WORLD_STEPS } from "./WhiteboardWorld";
export type {
  WhiteboardWorldProps,
  WhiteboardWorldStep,
} from "./WhiteboardWorld";

export { HiddenAssumption, HIDDEN_ASSUMPTION_STEPS } from "./HiddenAssumption";
export type {
  HiddenAssumptionProps,
  HiddenAssumptionStep,
} from "./HiddenAssumption";

export { MemoryWall, MEMORY_WALL_STEPS } from "./MemoryWall";
export type { MemoryWallProps, MemoryWallStep } from "./MemoryWall";

export { LatencyLadder, LATENCY_LADDER_STEPS } from "./LatencyLadder";
export type { LatencyLadderProps, LatencyLadderStep } from "./LatencyLadder";

export { GoogleReceipts, GOOGLE_RECEIPTS_STEPS } from "./GoogleReceipts";
export type { GoogleReceiptsProps, GoogleReceiptsStep } from "./GoogleReceipts";

export { CacheLine, CACHE_LINE_STEPS } from "./CacheLine";
export type { CacheLineProps, CacheLineStep } from "./CacheLine";

export { SweepVsChase, SWEEP_VS_CHASE_STEPS } from "./SweepVsChase";
export type { SweepVsChaseProps, SweepVsChaseStep } from "./SweepVsChase";

export {
  TrickQuestion,
  TRICK_QUESTION_STEPS,
  TRICK_QUESTION_NOMINAL,
} from "./TrickQuestion";
export type { TrickQuestionProps, TrickQuestionStep } from "./TrickQuestion";

export { HonestWalkback, HONEST_WALKBACK_STEPS } from "./HonestWalkback";
export type { HonestWalkbackProps, HonestWalkbackStep } from "./HonestWalkback";

export { ThreeRules, THREE_RULES_STEPS } from "./ThreeRules";
export type { ThreeRulesProps, ThreeRulesStep } from "./ThreeRules";

export { RealSystemPayoff, REAL_SYSTEM_PAYOFF_STEPS } from "./RealSystemPayoff";
export type {
  RealSystemPayoffProps,
  RealSystemPayoffStep,
} from "./RealSystemPayoff";

export {
  EndingTwoQuestions,
  ENDING_TWO_QUESTIONS_STEPS,
} from "./EndingTwoQuestions";
export type {
  EndingTwoQuestionsProps,
  EndingTwoQuestionsStep,
} from "./EndingTwoQuestions";
