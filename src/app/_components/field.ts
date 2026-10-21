/**
 * Form field styling, shared by the filter bar and its client components.
 *
 * Inputs and selects are the same material as the buttons -- 2px ink border,
 * same corner radius -- but they do not carry a hard shadow. The shadow in
 * this system means "pressable"; a text field is not.
 */
export const FIELD =
  "min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white " +
  "px-3 text-sm text-foreground outline-none transition " +
  "placeholder:text-placeholder " +
  "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court";

export const FIELD_LABEL =
  "text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55";

/**
 * Selects add our own chevron; see `.select-field` in globals.css for why the
 * native one is replaced rather than nudged with padding.
 */
export const SELECT_FIELD = `${FIELD} select-field`;
