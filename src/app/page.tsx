import { availabilityOptions } from "@/lib/runs/availability";
import { findMapVenues } from "@/server/venues/map-venues";
import { TorontoSkyline } from "./_components/toronto-skyline";
import { VenueMap } from "./_components/venue-map";

const filterFeatures = [
  {
    icon: AreaIcon,
    label: "Area search",
    description: "Find runs within your travel range",
  },
  {
    icon: CalendarIcon,
    label: "Availability",
    description: "Today, tonight, or this week",
  },
  {
    icon: ClipboardIcon,
    label: "Run details",
    description: "See level, schedule, and capacity",
  },
];

export default async function Home() {
  // Every pin ships in this payload. See findMapVenues for why there is no
  // bounding-box endpoint behind it.
  const mapVenues = await findMapVenues(new Date());

  return (
    <main className="pb-10 pt-6 text-foreground sm:pt-16">
      {/*
        The hero and the skyline share a stacking context so the drawing can sit
        behind the headline and the search bar. The wrapper is full-bleed while
        the content inside stays in the 7xl column, which is what lets the band
        reach both edges of the viewport as it did when it was in flow.

        min-h is a mobile-only clamp that holds the hero to the viewport minus a
        strip, so the top of the map is always on screen when the page opens.

        The 290px is measured, not derived: it has to cover everything between
        the top of the viewport and the top of the map that is not the hero
        itself -- the 88px fixed header above this main, this main's top
        padding, the gap below the hero -- and then leave about 120px of map
        showing. Changing the header height or those paddings changes this
        number, which is why it is checked against a real viewport rather than
        reasoned about.

        On md and up the clamp is off entirely: the hero's natural height
        already leaves a generous slice of map in view at desktop sizes, and a
        viewport-relative hero on a large monitor would only add empty space.
      */}
      <div className="relative">
        {/*
          The skyline is anchored to the bottom of the hero, and the hero's
          bottom padding is what decides how far down the drawing sits.

          That padding has to be proportional, not fixed. The SVG is width:100%
          on a 1440x260 viewBox, so its rendered height is always about 18vw --
          260px at a 1440px viewport, 347px at 1920. A fixed padding would clear
          the headline at one width and let the CN Tower punch back up through
          it at another.

          13.54vw is that height for the widened 1920x260 canvas, and padding by
          the full band height plus 1rem puts the top of the drawing just below
          the search bar: the whole city is visible, including the mast and the
          moon, and the bar sits above the skyline rather than cutting through
          it.

          Straddling was tried first and rejected on sight. There are only about
          80px between the headline and the bar, and the band is 195px at this
          width, so no arrangement fits the city into that gap -- the bar ends up
          bisecting it, leaving roof lines above and a sliver of bases below.
          Clearing the bar entirely is the only placement where the drawing
          still reads as a skyline.
        */}
        <TorontoSkyline className="pointer-events-none absolute inset-x-0 bottom-0 w-full" />

        <section className="relative mx-auto min-h-[calc(100svh-290px)] w-full max-w-7xl px-6 pb-[calc(13.54vw+1rem)] md:min-h-0">
        {/*
          clamp() rather than breakpoints: the headline is the one element that
          should track viewport width continuously. 8.6vw is tuned so that
          "Find basketball runs" fills the 1280px container and "near you."
          falls to a second line on its own, which is the composition the
          design calls for -- no manual <br /> needed.
        */}
        <h1 className="mb-6 mt-2 text-[clamp(52px,8.6vw,124px)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground sm:mb-12 sm:mt-6">
          Find basketball runs <span className="text-court">near you.</span>
        </h1>

        <form action="/runs" className="flex flex-wrap items-stretch gap-4">
          {/*
            flex-[999_1_640px] is the trick that keeps the button beside the
            bar until the bar is genuinely squeezed. The huge grow factor means
            every spare pixel in the row goes to the bar rather than the
            button; the 640px basis is what the bar needs before it is allowed
            to wrap. No media query can express "wrap when you run out of
            room" as directly as this.
          */}
          {/*
            No focus ring on this container, deliberately.

            It carried an orange focus-within ring, which read as a glow every
            time the bar was clicked. :focus-visible was tried as a way to keep
            a ring for keyboard users only, and does not work here: the spec has
            browsers always match :focus-visible on text inputs, however focus
            arrived, on the reasoning that anything typeable deserves a visible
            ring. So there is no CSS that shows a ring on Tab but not on click
            for this control.

            Removing it was chosen knowingly over keeping a ring on click. The
            cost is real -- the inner input also sets outline-none, so a
            keyboard user gets no indicator on this control -- and if that
            becomes a problem the fix is a ring here, not a different variant.
          */}
          <div className="flex min-w-0 flex-[999_1_640px] flex-wrap overflow-hidden rounded-[20px] border-2 border-foreground bg-white shadow-[0_6px_0_0_var(--foreground)]">
            <label htmlFor="home-location" className="sr-only">
              City or neighbourhood
            </label>
            <input
              id="home-location"
              name="location"
              type="search"
              autoComplete="address-level2"
              placeholder="North York, Scarborough, Etobicoke…"
              className="min-h-[72px] min-w-0 flex-[1_1_240px] bg-transparent px-[22px] text-[18px] text-foreground outline-none placeholder:text-placeholder"
            />

            <div className="flex min-h-[72px] min-w-0 items-center gap-2 border-l border-line px-[18px]">
              <CalendarIcon
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={2}
              />
              <label htmlFor="home-availability" className="sr-only">
                When
              </label>
              {/*
                A native <select>: it brings keyboard support, the platform
                picker on mobile and form submission for free, and the only
                part of it that cannot be styled is the open menu, which the
                design does not specify.
              */}
              <select
                id="home-availability"
                name="availability"
                defaultValue="upcoming"
                className="select-field min-w-0 bg-transparent pl-1 py-2 text-[17px] font-medium text-foreground outline-none"
              >
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[76px] flex-[1_1_200px] items-center justify-center gap-[10px] rounded-[20px] border-2 border-foreground bg-court text-[17px] font-extrabold tracking-[0.6px] text-foreground shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)] active:translate-y-[6px] active:shadow-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none"
          >
            FIND RUNS
            <ChevronRightIcon className="h-[18px] w-[18px]" />
          </button>
        </form>
        </section>
      </div>

      {/*
        The map's own section, deliberately with no visible heading: a house
        heading is ~56px plus margins, which is most of the peek budget, and a
        visitor arriving at the fold would see a heading rather than a map. The
        sr-only h2 keeps the document outline intact for assistive technology
        and search engines at no vertical cost -- the same trick the run detail
        page uses for its title.
      */}
      <section className="mx-auto mt-6 w-full max-w-7xl px-6 sm:mt-8">
        <h2 className="sr-only">Map of basketball venues</h2>

        {/*
          isolate is load-bearing. Leaflet positions its panes at z-index
          400-700 and its controls at 800-1000, and this card creates no
          stacking context of its own, so those values were competing directly
          with the sticky header's z-30 -- and winning, which is why the map
          scrolled over the nav. isolation: isolate scopes them to this card, so
          the whole map participates in the page at one level and the header
          sits above it.
        */}
        <div className="isolate overflow-hidden rounded-[20px] border-2 border-foreground bg-surface shadow-[0_6px_0_0_var(--foreground)]">
          {/*
            A fixed height rather than an aspect ratio, so the box the server
            renders is exactly the box Leaflet fills and nothing on the page
            shifts when the map's JavaScript arrives.
          */}
          <VenueMap
            venues={mapVenues}
            className="h-[420px] w-full sm:h-[520px]"
          />
        </div>

        {mapVenues.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-foreground/70">
            No venues are on the map yet. Venues appear here once they have
            coordinates and at least one upcoming run.
          </p>
        ) : null}
      </section>

      <section className="mx-auto mt-16 w-full max-w-7xl px-6 lg:mt-20">
        <h2 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em] text-foreground">
          What you can filter
        </h2>

        {/*
          Three cards in the house style: ink border, hard shadow straight
          down, surface lighter than the page so they read as raised. The
          dividers this section used to rely on were vertical hairlines
          between columns, which only worked against the dark photo; on
          cream the card edge does that job.
        */}
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {filterFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.label}
                className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] sm:p-7"
              >
                <Icon className="h-9 w-9 text-court" />
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {feature.label}
                </h3>
                <p className="mt-3 text-base leading-7 text-foreground/70">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

type IconProps = {
  className?: string;
  /**
   * The icons are drawn on a 24px grid but used at two very different sizes.
   * A stroke that reads correctly on the 36px feature icons looks thin at the
   * 18px size the search bar uses, so the weight is a prop rather than baked
   * into each path.
   */
  strokeWidth?: number;
};

function ChevronRightIcon({ className, strokeWidth = 2.6 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function AreaIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3v3m0 12v3M3 12h3m12 0h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 3v3m10-3v3M5 8h14M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M9 13h3v3H9z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function ClipboardIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 5h6m-5 5h6m-6 4h4M8 4h8l1 3h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l1-3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
