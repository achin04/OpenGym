/**
 * One map pin's data.
 *
 * Lives in lib rather than beside the query because both sides of the client
 * boundary need it: the server component that loads the pins and the client
 * component that draws them. The query module imports `server-only`, so a
 * client component cannot take the type from there without reaching into a
 * module it must never bundle.
 */
export type MapVenue = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};
