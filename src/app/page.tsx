import Link from "next/link";
import { raisedButtonClass } from "@/app/_components/raised-button";
import { availabilityOptions } from "@/lib/runs/availability";
import { findMapVenues } from "@/server/venues/map-venues";
import { TorontoSkyline } from "./_components/toronto-skyline";
import { VenueMap } from "./_components/venue-map";

const howItWorksSteps = [
  {
    icon: SearchIcon,
    title: "Search your area",
    body: "Enter a city, neighbourhood, gym or postal code, then pick when you can play \u2014 tonight, this weekend or any day you choose.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Pick your run",
    body: "Compare the time, venue, age group and who's hosting. City of Toronto programs are marked official so you know what you're getting.",
  },
  {
    icon: BasketballIcon,
    title: "Show up and hoop",
    body: "Open the run for the full details, grab directions and head to the court. No group chats, no guessing.",
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
              placeholder="Toronto, East York, or M9V 4L9"
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
        The map band, full-bleed dark against the cream page.

        It carries a real heading now. The earlier version used an sr-only one
        to protect the peek -- a house heading plus a line of body copy is about
        120px, most of the budget -- but a dark band with a title is a stronger
        "there is more below" signal than a sliver of map was, so the peek is
        spent on saying what the thing is rather than showing an inch of it.

        Full-bleed means the band escapes the 7xl column while its contents stay
        inside it, hence the wrapper.

        The negative top margin makes the band begin exactly on the skyline's
        ground line, so the city stands on the dark rather than floating above
        it. Two things had to close for that: the old margin, and the 8 units of
        empty canvas below the ground line -- the drawing's baseline is at y=252
        of a 260-tall viewBox, so 3.08% of the rendered band is nothing at all.
        0.417vw is that 3.08% of the band's own 13.54vw height, so the seam
        holds at every width the way the band's height does.
      */}
      <section className="mt-[-0.417vw] w-full bg-foreground py-12 sm:py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em] text-background">
            See where the <span className="text-court">runs are.</span>
          </h2>

          <p className="mt-3 max-w-2xl text-base leading-7 text-background/70">
            Tap a cluster to zoom in, or pick a pin to see that venue&rsquo;s
            upcoming runs.
          </p>

        {/*
          isolate is load-bearing. Leaflet positions its panes at z-index
          400-700 and its controls at 800-1000, and this card creates no
          stacking context of its own, so those values were competing directly
          with the sticky header's z-30 -- and winning, which is why the map
          scrolled over the nav. isolation: isolate scopes them to this card, so
          the whole map participates in the page at one level and the header
          sits above it.
        */}
          {/*
            The card's edge and shadow switch to court orange on this band. The
            house ink border would disappear into a near-black background, and
            the shadow with it, so the card would lose the raised read that
            every other surface on the site has.
          */}
          <div className="isolate mt-8 overflow-hidden rounded-[20px] border-2 border-court bg-surface shadow-[0_6px_0_0_var(--court)]">
            {/*
              A fixed height rather than an aspect ratio, so the box the server
              renders is exactly the box Leaflet fills and nothing on the page
              shifts when the map's JavaScript arrives.

              Taller than it needs to be to show the pins, on purpose: at the
              old height the map read as an illustration of Toronto. Enough
              height to pan around in is what says it can be panned around in.
            */}
            <VenueMap
              venues={mapVenues}
              className="h-[480px] w-full sm:h-[640px]"
            />
          </div>

          {mapVenues.length === 0 ? (
            <p className="mt-4 text-sm font-medium text-background/70">
              No venues are on the map yet. Venues appear here once they have
              coordinates and at least one upcoming run.
            </p>
          ) : null}
        </div>
      </section>

      {/*
        scroll-mt clears the sticky header, which is 88px tall and would
        otherwise sit over this heading when the nav's "How it works" link
        jumps here.
      */}
      <section
        id="how-it-works"
        className="mx-auto mt-16 w-full max-w-7xl scroll-mt-28 px-6 lg:mt-20"
      >
        <h2 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em] text-foreground">
          How it <span className="text-court-700">works.</span>
        </h2>

        <p className="mt-3 text-base leading-7 text-foreground/70">
          From couch to court in three steps.
        </p>

        {/*
          White rather than the usual bg-surface. These three sit directly on
          the cream page with nothing else competing, and the extra step away
          from the background is what makes them read as the subject of the
          section rather than part of it.
        */}
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {howItWorksSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                key={step.title}
                className="rounded-[20px] border-2 border-foreground bg-white p-6 shadow-[0_6px_0_0_var(--foreground)] sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  {/*
                    aria-hidden because the <ol> already conveys the order to a
                    screen reader; read out, the numeral would be said twice.
                  */}
                  <span
                    aria-hidden="true"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-court text-lg font-bold text-foreground"
                  >
                    {index + 1}
                  </span>

                  <Icon className="mt-1 h-6 w-6 text-foreground" />
                </div>

                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {step.title}
                </h3>

                <p className="mt-3 text-base leading-7 text-foreground/70">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>

        {/*
          Dashed rather than the solid card border used everywhere else: this
          strip is an invitation to add something, not another thing to read,
          and the dashed edge says "empty slot" the way a card outline cannot.
        */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-[20px] border-2 border-dashed border-foreground/55 p-6 sm:p-7">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              Running a game?
            </h3>
            <p className="mt-2 text-base leading-7 text-foreground/70">
              Add your run to OpenGym so players nearby can find it.
            </p>
          </div>

          <Link
            href="/runs/new"
            className={`${raisedButtonClass()} gap-2`}
          >
            <PlusIcon className="h-4 w-4" />
            Add a run
          </Link>
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

function SearchIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="m16 16 4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function CalendarCheckIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 3v3m10-3v3M5 9h14M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="m9 14.5 2 2 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/* Seams drawn as the real ball has them: one vertical, one horizontal, and two
   curved side seams -- at 24px the usual four-arc rosette turns to mush. */
function BasketballIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M12 3v18M3 12h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M5.6 5.6a12 12 0 0 1 0 12.8M18.4 5.6a12 12 0 0 0 0 12.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function PlusIcon({ className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
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
