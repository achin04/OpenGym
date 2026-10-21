/**
 * The shared shell for the two nav buttons.
 *
 * Geometry was measured off the Figma export rather than guessed. The export is
 * a ~2.5x screenshot, so the values below are the 1x source spec:
 *
 *   height        46px   (2px border + 12px padding + 18px line box, doubled)
 *   border        2px    solid --foreground
 *   corner radius 10px
 *   padding-x     21px
 *   type          Inter Medium 15px / 18px
 *
 * Two things changed when the homepage design spec landed, and both were
 * deliberate:
 *
 * 1. The shadow was `4px 4px 0` -- down AND right, measured off that same
 *    Figma export. The spec defines the house style as `0 Npx 0`: straight
 *    down, no horizontal offset. A diagonal shadow in the header above a
 *    vertical one in the hero reads as a bug, so the header yielded. The
 *    offset also grew 4px -> 6px in the hero because those controls are much
 *    larger; the 46px nav buttons keep 4px.
 *
 * 2. The colours are now --foreground and --court, the site-wide ink and
 *    accent. They used to be --btn-ink (#2e2f34) and --btn-accent (#ed7640),
 *    which were a few hex points off the ink and orange everything else used
 *    -- close enough to look like a rendering artefact rather than a choice.
 *
 * The solid variant's label is ink, not white. White on #ee7b3a is about
 * 2.4:1, which fails WCAG AA for text at this size; #141414 on the same orange
 * is about 7:1. The hero's FIND RUNS button is specified the same way.
 *
 * Figma specifies no interaction states, so the motion is the convention this
 * button style carries: the surface slides into its own shadow on press, as if
 * the button were physically pushed down onto the page.
 */

type NavButtonVariant = "outline" | "solid";

const SHELL =
  "inline-flex h-[46px] shrink-0 items-center justify-center whitespace-nowrap " +
  "rounded-[10px] border-2 border-foreground px-[21px] " +
  "text-[15px] font-medium leading-[18px] " +
  "transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none " +
  "focus:outline-none focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-foreground";

const FILL: Record<NavButtonVariant, string> = {
  outline: "bg-white text-foreground",
  solid: "bg-court text-foreground",
};

/** Resting: full shadow, sinking into it on hover and fully on press. */
const RAISED =
  "shadow-[0_4px_0_0_var(--foreground)] " +
  "hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] " +
  "active:translate-y-[4px] active:shadow-none";

/** Held down: used for the nav link pointing at the page you are already on. */
const PRESSED = "translate-y-[4px] shadow-none";

export function navButtonClass(
  variant: NavButtonVariant,
  options: { pressed?: boolean } = {},
) {
  return [SHELL, FILL[variant], options.pressed ? PRESSED : RAISED].join(" ");
}
