/**
 * The single address string used whenever a venue has to be located by text:
 * the "Get directions" link on the run detail page, and the Nominatim geocode
 * that fills in the venue's coordinates.
 *
 * Both callers must agree. If the directions link and the geocoder were given
 * different strings they could resolve to different places, and the map pin
 * would silently disagree with the link next to it.
 *
 * addressLine2 is deliberately omitted: unit and suite numbers degrade address
 * matching rather than improve it. The region is pinned because Venue has no
 * province or country column -- runs are Toronto-only today -- and without it
 * "150 Sherbourne St" matches streets in several countries.
 */
export type VenueGeoQueryParts = {
  addressLine1: string;
  city: string;
  postalCode?: string | null;
};

export function buildVenueGeoQuery(parts: VenueGeoQueryParts): string {
  return [parts.addressLine1, parts.city, parts.postalCode, "ON, Canada"]
    .filter(Boolean)
    .join(", ");
}

/**
 * A Google Maps link for a venue.
 *
 * Built from the same string the geocoder is given, so the pin on the map and
 * the directions link beside it can never point at different places. This is a
 * plain link-out and needs no key or billing account, which is why it survived
 * the move to Leaflet tiles untouched.
 */
export function googleDirectionsUrl(parts: VenueGeoQueryParts): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    buildVenueGeoQuery(parts),
  )}`;
}
