// Component registry — read this before creating a new component; the one
// you need may already exist under a different name.
export { LayerPeel } from "./LayerPeel";
export { TopicIcons } from "./TopicIcons";
export { DivergingLines } from "./DivergingLines";
export { NarrowingEntry } from "./NarrowingEntry";
export { AnnotatedImage } from "./AnnotatedImage";
export type { AnnotatedImageProps } from "./AnnotatedImage";
export { ScreenRecording } from "./ScreenRecording";
export type { ScreenRecordingProps } from "./ScreenRecording";
export { FakeTerminal } from "./FakeTerminal";
export type { FakeTerminalProps } from "./FakeTerminal";
export { KineticCaption } from "./KineticCaption";
export type { KineticCaptionProps } from "./KineticCaption";
export { BeatFade } from "./BeatFade";
export { BarReveal, LineReveal } from "./charts";
export type {
  BarRevealProps,
  BarDatum,
  LineRevealProps,
  LineSeries,
  LinePoint,
} from "./charts";
export { BRoll } from "./BRoll";
export type { BRollProps } from "./BRoll";
export { MemoryGrid, gridDockScale } from "./MemoryGrid";
export type { MemoryGridProps, MemoryGridMode } from "./MemoryGrid";
export { ReceiptPanel } from "./ReceiptPanel";
export type { ReceiptPanelProps } from "./ReceiptPanel";
// Shared chart geometry. Any two charts that morph into one another must agree
// on these numbers or the transition becomes a jump cut. Import from here,
// never re-declare.
export * as chartGeom from "./chartGeom";
export { SfxLayer } from "./SfxLayer";
export type { SfxLayerProps, SfxEvent } from "./SfxLayer";
export { REVEAL_FRAMES, theme } from "./theme";
