/**
 * Form field styling, shared by the filter bar, the create-run form and their
 * client components.
 *
 * Fields are the same material as the buttons -- 2px ink border, same corner
 * radius -- but they carry no hard shadow. The shadow in this system means
 * "pressable"; a field you type into is not.
 */
const BASE =
  "w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white " +
  "px-3 text-sm text-foreground outline-none transition " +
  "placeholder:text-placeholder " +
  "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court";

/** Single-line inputs and selects, sized by a minimum tap target. */
export const FIELD = `min-h-11 ${BASE}`;

/** Multi-line input: height comes from `rows`, so it takes padding instead. */
export const TEXTAREA_FIELD = `${BASE} py-2.5`;

/**
 * Selects add our own chevron; see `.select-field` in globals.css for why the
 * native one is replaced rather than nudged with padding.
 */
export const SELECT_FIELD = `${FIELD} select-field`;

/** The small uppercase label above a filter control. */
export const FIELD_LABEL =
  "text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55";

/**
 * The label above a form field. Longer and sentence-cased rather than the
 * filter bar's uppercase eyebrows, because a form is read, not scanned.
 */
export const FORM_LABEL = "text-sm font-semibold text-foreground";
