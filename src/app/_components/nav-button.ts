/**
 * The shared shell for the two nav buttons.
 *
 * Every number here was measured off the Figma export rather than guessed. The
 * export is a ~2.5x screenshot, so the values below are the 1x source spec:
 *
 *   height        46px   (2px border + 12px padding + 18px line box, doubled)
 *   border        2px    solid --btn-ink
 *   corner radius 10px
 *   shadow        4px 4px 0 --btn-ink   (hard, no blur, no spread, no alpha)
 *   padding-x     21px
 *   type          Inter Medium 15px / 18px
 *
 * The two variants differ only in fill and text colour: `outline` is the
 * white "Login" button, `solid` is the orange "Create free account" button.
 *
 * Figma specifies no interaction states, so the motion is the convention this
 * button style carries: the surface slides into its own shadow on press, as if
 * the button were physically pushed down onto the page.
 */

type NavButtonVariant = "outline" | "solid";

const SHELL =
  "inline-flex h-[46px] shrink-0 items-center justify-center whitespace-nowrap " +
  "rounded-[10px] border-2 border-btn-ink px-[21px] " +
  "font-inter text-[15px] font-medium leading-[18px] " +
  "transition-[transform,box-shadow] duration-150 ease-out " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-btn-ink focus-visible:ring-offset-2";

const FILL: Record<NavButtonVariant, string> = {
  outline: "bg-white text-btn-ink",
  solid: "bg-btn-accent text-white",
};

/** Resting: full shadow, sinking into it on hover and fully on press. */
const RAISED =
  "shadow-[4px_4px_0_0_var(--btn-ink)] " +
  "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--btn-ink)] " +
  "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none";

/** Held down: used for the nav link pointing at the page you are already on. */
const PRESSED = "translate-x-[4px] translate-y-[4px] shadow-none";

export function navButtonClass(
  variant: NavButtonVariant,
  options: { pressed?: boolean } = {},
) {
  return [SHELL, FILL[variant], options.pressed ? PRESSED : RAISED].join(" ");
}
