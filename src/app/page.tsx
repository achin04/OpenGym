import { availabilityOptions } from "@/lib/runs/availability";
import { TorontoSkyline } from "./_components/toronto-skyline";

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

export default function Home() {
  return (
    <main className="pb-10 pt-14 text-foreground">
      <section className="mx-auto w-full max-w-7xl px-6">
        {/*
          clamp() rather than breakpoints: the headline is the one element that
          should track viewport width continuously. 8.6vw is tuned so that
          "Find basketball runs" fills the 1280px container and "near you."
          falls to a second line on its own, which is the composition the
          design calls for -- no manual <br /> needed.
        */}
        <h1 className="mb-10 mt-6 text-[clamp(52px,8.6vw,124px)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground">
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
          <div className="flex min-w-0 flex-[999_1_640px] flex-wrap overflow-hidden rounded-[20px] border-2 border-foreground bg-white shadow-[0_6px_0_0_var(--foreground)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-court">
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

      <TorontoSkyline className="mt-10 w-full" />

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
