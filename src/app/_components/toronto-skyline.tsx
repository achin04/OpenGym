/**
 * The decorative Toronto skyline band under the hero.
 *
 * Inline SVG rather than a file in /public for two reasons: the stroke colour
 * can then be a CSS token (`currentColor`, driven by --skyline), and the
 * browser never makes a second request for it -- it arrives with the HTML.
 *
 * The drawing is original, authored in the visual vocabulary of the reference
 * art rather than traced from it: one uniform stroke weight, round caps and
 * joins, no fills, towers as plain rectangles with ruled window slots, the CN
 * Tower as a tapered shaft with a two-part pod and a mast, the arena as a
 * flattened dome with a single band. The reference was a watermarked stock
 * illustration, so copying its paths was not an option; the style itself is
 * just line-icon convention.
 *
 * Nothing overlaps. With fill="none" an overlapping tower would show the one
 * behind it straight through, which the reference avoids by filling shapes
 * white. Keeping buildings edge-to-edge instead gets the same read without
 * introducing a fill colour that would have to track the page background.
 *
 * The recognisable group -- tower, moon, clouds, dome, office slab -- sits at
 * the centre; everything outward of it is generic filler at the same weight,
 * there so the band reaches both edges of the viewport at any width.
 *
 * Geometry: a 1440x260 canvas with the ground line at y=252. Width is 100% and
 * height is left unset, so the browser derives it from the viewBox ratio and
 * the whole band scales uniformly -- about 260px tall at a 1440px viewport.
 */
export function TorontoSkyline({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox="0 0 1440 260"
        width="100%"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="block w-full text-skyline"
      >
        {/* Ground */}
        <path d="M0 252H1440" />

        {/* --- Left filler --- */}
        <rect x="-12" y="182" width="112" height="70" />
        <rect x="112" y="146" width="66" height="106" />
        <path d="M145 146v-22" />
        <rect x="190" y="200" width="96" height="52" />
        <rect x="300" y="160" width="74" height="92" />
        <path d="M314 186h20M344 186h16M314 212h20M344 212h16" />
        <rect x="388" y="204" width="88" height="48" />
        <rect x="486" y="176" width="30" height="76" />

        {/* --- CN Tower: tapered shaft, two-part pod, mast --- */}
        <path d="M535 252L543 122M569 252L561 122" />
        <rect x="516" y="94" width="72" height="28" rx="14" />
        <rect x="534" y="72" width="36" height="22" rx="11" />
        <path d="M552 72V30" />

        {/* --- Moon and clouds --- */}
        <circle cx="648" cy="72" r="22" />
        <path d="M700 48h26M738 48h50M712 72h26M750 72h42" />

        {/* --- Arena dome --- */}
        <path d="M604 252a56 56 0 0 1 112 0" />
        <path d="M610 230h100" />

        {/* --- Office slab with window slots --- */}
        <rect x="718" y="124" width="104" height="128" />
        <path d="M734 150h32M776 150h32M734 176h32M776 176h32M734 202h32M776 202h32M734 228h32M776 228h32" />

        {/* --- Tower with mast --- */}
        <rect x="822" y="88" width="68" height="164" />
        <path d="M856 88V52" />

        {/* --- Low block --- */}
        <rect x="890" y="196" width="48" height="56" />

        {/* --- Right filler --- */}
        <rect x="962" y="150" width="78" height="102" />
        <rect x="1056" y="104" width="72" height="148" />
        <path d="M1092 104V78" />
        <path d="M1070 132h22M1100 132h20M1070 160h22M1100 160h20M1070 188h22M1100 188h20M1070 216h22M1100 216h20" />
        <rect x="1146" y="186" width="92" height="66" />
        <rect x="1256" y="138" width="70" height="114" />
        <rect x="1342" y="176" width="64" height="76" />
        <rect x="1406" y="146" width="34" height="106" />
      </svg>
    </div>
  );
}
