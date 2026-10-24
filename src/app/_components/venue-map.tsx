"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { MapVenue } from "@/lib/venues/map-venue";
// Stylesheets are safe to import at module scope: they touch no browser API,
// and Next extracts them at build time. Only Leaflet's JavaScript has to wait
// for the effect. MarkerCluster.Default.css is deliberately not imported --
// it carries the library's blue-and-green bubbles, which the .og-cluster rules
// in globals.css replace.
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";

/**
 * The clustered venue map on the home page.
 *
 * Leaflet is created imperatively in an effect rather than through a React
 * wrapper library. That is not only a dependency preference: `ssr: false` is
 * rejected inside Server Components, so a react-leaflet tree -- which builds
 * Leaflet objects during render and therefore cannot be prerendered -- would
 * need a client wrapper that exists purely to host a dynamic() call. An effect
 * never runs during prerender, so the problem disappears instead of being
 * worked around.
 *
 * The Leaflet import is dynamic and inside the effect for the same reason. A
 * top-level `import "leaflet"` would still be evaluated when this component is
 * prerendered on the server, and Leaflet reads `window` at module scope to
 * build its browser-feature table.
 */
const TORONTO_FALLBACK_CENTER: Leaflet.LatLngTuple = [43.7001, -79.4163];
const TORONTO_FALLBACK_ZOOM = 10;

// Capped so that a dense cluster of downtown venues does not open the page
// zoomed into a single city block.
const FIT_BOUNDS_MAX_ZOOM = 14;
const SINGLE_VENUE_ZOOM = 14;

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// Required by the tile licence, not a courtesy.
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Venue names are interpolated into popup HTML, because Leaflet's popups take
 * markup rather than React children. Anything crossing that boundary is
 * escaped: venue names are operator- and import-supplied strings, and the one
 * with an apostrophe or an angle bracket in it will turn up eventually.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function popupHtml(venue: MapVenue): string {
  const name = escapeHtml(venue.name);

  return `
    <span class="og-popup-name">${name}</span>
    <a class="og-popup-link" href="/runs?venueId=${encodeURIComponent(venue.id)}">View Runs</a>
  `;
}

function clusterSizeClass(count: number): string {
  if (count < 10) {
    return "og-cluster--sm";
  }

  return count < 50 ? "og-cluster--md" : "og-cluster--lg";
}

type VenueMapProps = {
  venues: MapVenue[];
  className?: string;
};

export function VenueMap({ venues, className }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const build = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");

      // Effects run twice in development under StrictMode, and the awaits above
      // mean a second pass can begin before the first finishes. Both guards are
      // needed: `cancelled` stops a torn-down pass, and the existing-map check
      // stops a second map being attached to the same container, which Leaflet
      // rejects with "Map container is already initialized".
      if (cancelled || mapRef.current) {
        return;
      }

      const map = L.map(container, {
        center: TORONTO_FALLBACK_CENTER,
        zoom: TORONTO_FALLBACK_ZOOM,
        // The map sits inside the scrolling page, so grabbing the wheel would
        // trap a visitor scrolling past it. Ctrl/⌘ + wheel still zooms, and so
        // do the buttons, pinch, and double-click.
        scrollWheelZoom: false,
      });

      mapRef.current = map;

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 60,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();

          return L.divIcon({
            html: `<div class="og-cluster ${clusterSizeClass(count)}">${count}</div>`,
            className: "",
            iconSize: L.point(44, 44),
          });
        },
      });

      const pinIcon = L.divIcon({
        html: '<div class="og-pin"></div>',
        className: "",
        iconSize: L.point(20, 20),
        // Anchored at the point of the teardrop, so the pin marks the venue
        // rather than hovering above it.
        iconAnchor: L.point(10, 20),
        popupAnchor: L.point(0, -18),
      });

      for (const venue of venues) {
        L.marker([venue.latitude, venue.longitude], {
          icon: pinIcon,
          title: venue.name,
          alt: venue.name,
        })
          .bindPopup(popupHtml(venue))
          .addTo(clusterGroup);
      }

      map.addLayer(clusterGroup);

      // fitBounds on a single pin zooms to maximum -- one rooftop -- and on an
      // empty list throws on invalid bounds. Both cases are real: an empty list
      // is what the map shows before the coordinate backfill has run.
      if (venues.length === 1) {
        const [only] = venues;

        if (only) {
          map.setView([only.latitude, only.longitude], SINGLE_VENUE_ZOOM);
        }
      } else if (venues.length > 1) {
        map.fitBounds(
          L.latLngBounds(
            venues.map(
              (venue) => [venue.latitude, venue.longitude] as Leaflet.LatLngTuple,
            ),
          ),
          { padding: [32, 32], maxZoom: FIT_BOUNDS_MAX_ZOOM },
        );
      }

      // The map mounts while only its top edge is on screen, and its height can
      // settle after layout. Leaflet caches the container size at creation, so
      // without this it renders tiles against a stale height and leaves grey
      // bands. The observer also covers viewport resizes and orientation
      // changes for free.
      map.invalidateSize();

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    };

    void build();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [venues]);

  return (
    <div
      ref={containerRef}
      // A fixed height, matching the server-rendered placeholder, so nothing on
      // the page jumps when Leaflet finishes loading.
      className={className}
      role="application"
      aria-label="Map of basketball venues with upcoming runs"
    />
  );
}
