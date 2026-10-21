import { raisedButtonClass, type RaisedVariant } from "./raised-button";

/**
 * The header's two nav buttons.
 *
 * This is the `nav` size of the shared raised-button style; see
 * `raised-button.ts` for the shape, the shadow and why the solid variant's
 * label is ink rather than white.
 */
export function navButtonClass(
  variant: RaisedVariant,
  options: { pressed?: boolean } = {},
) {
  return raisedButtonClass({ variant, size: "nav", pressed: options.pressed });
}
