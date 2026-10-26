/**
 * The site's raised-button style, in one place.
 *
 * Every pressable surface on the site is the same object: a 2px ink border, a
 * hard shadow straight down with no blur, and a press that slides the surface
 * into its own shadow as if it were pushed onto the page. Only the fill and
 * the metrics change.
 *
 * `nav` metrics come from the Figma export of the header (46px tall, 21px
 * side padding, 15/18). `control` is the looser size used for page-level
 * buttons -- Search, Add a run, View run -- where the label length varies and
 * a fixed height would be wrong.
 *
 * Both sizes are semibold. The header was Inter Medium, a weight nothing else
 * in the app used, and against the runs page -- where every button is 600 or
 * 800 -- the nav read as unfinished rather than as restrained. One weight for
 * every button, two sizes.
 *
 * Every variant's label is ink, not white: white on #ee7b3a is about 2.4:1
 * and fails WCAG AA, while #141414 on it is about 7:1. The same holds for the
 * success and danger fills.
 */
export type RaisedVariant = "outline" | "solid" | "success" | "danger";
export type RaisedSize = "nav" | "control";

const BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap " +
  "rounded-[10px] border-2 border-foreground " +
  "transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none " +
  "focus:outline-none focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-foreground";

const SIZE: Record<RaisedSize, string> = {
  nav: "h-[46px] px-[21px] text-[15px] font-semibold leading-[18px]",
  control: "min-h-11 px-4 py-2 text-sm font-semibold",
};

const FILL: Record<RaisedVariant, string> = {
  outline: "bg-white text-foreground",
  solid: "bg-court text-foreground",
  // Admin only: see --success / --danger in globals.css for why these two
  // exist when the rest of the site runs on a single accent.
  success: "bg-success text-foreground",
  danger: "bg-danger text-foreground",
};

/** Resting: full shadow, sinking into it on hover and fully on press. */
const RAISED =
  "shadow-[0_4px_0_0_var(--foreground)] " +
  "hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] " +
  "active:translate-y-[4px] active:shadow-none";

/** Held down: for a control that points at the state you are already in. */
const PRESSED = "translate-y-[4px] shadow-none";

export function raisedButtonClass({
  variant = "outline",
  size = "control",
  pressed = false,
}: {
  variant?: RaisedVariant;
  size?: RaisedSize;
  pressed?: boolean;
} = {}) {
  return [BASE, SIZE[size], FILL[variant], pressed ? PRESSED : RAISED].join(" ");
}
