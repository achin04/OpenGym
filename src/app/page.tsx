import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "./_components/brand";

const popularLocations = ["Toronto", "Etobicoke", "North York", "Scarborough"];

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
    <main className="px-5 pb-16 pt-14 text-cream sm:px-6 sm:pb-20 sm:pt-16 lg:pt-20">
      <section className="mx-auto w-full max-w-7xl">
        <div className="max-w-4xl">
          <div className="space-y-5">
            <h1 className="flex max-w-4xl items-start gap-4 text-4xl font-semibold tracking-normal text-cream sm:items-center sm:gap-5 sm:text-5xl">
              <BrandMark glow size="hero" />
              <span>
                Find basketball runs{" "}
                <span className="text-[#f47b2a]">near you.</span>
              </span>
            </h1>
            <p className="max-w-[34rem] text-lg leading-8 text-cream/68">
              Enter a city or neighborhood, set when you can play, and OpenGym
              shows available drop-in runs.
            </p>
          </div>

          <form
            action="/runs"
            className="mt-9 grid gap-2 rounded-xl border border-[#444] bg-[#111111]/95 p-2 shadow-2xl shadow-black/25 transition duration-200 focus-within:border-court/80 focus-within:shadow-court/10 sm:grid-cols-[minmax(0,1fr)_13rem_4.5rem] sm:items-center"
          >
            <div className="flex min-h-14 items-center gap-3 rounded-lg border border-[#292929] bg-[#101010] px-4 transition focus-within:border-court/70 focus-within:ring-2 focus-within:ring-court/20">
              <LocationIcon className="h-5 w-5 shrink-0 text-court-200" />
              <label
                htmlFor="home-location"
                className="sr-only"
              >
                City or area
              </label>
              <input
                id="home-location"
                name="location"
                type="search"
                autoComplete="address-level2"
                placeholder="Toronto, North York, Scarborough"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-[#F4F4F4] outline-none placeholder:text-[#8e8e8e]"
              />
            </div>

            <div className="flex min-h-14 items-center rounded-lg border border-[#292929] bg-[#101010] px-4 transition focus-within:border-court/70 focus-within:ring-2 focus-within:ring-court/20">
              <label
                htmlFor="home-availability"
                className="sr-only"
              >
                Availability
              </label>
              <select
                id="home-availability"
                name="availability"
                defaultValue="upcoming"
                className="h-full w-full bg-transparent text-base text-[#F4F4F4] outline-none"
              >
                <option value="upcoming">Upcoming</option>
                <option value="today">Today</option>
                <option value="tonight">Tonight</option>
                <option value="week">Next 7 days</option>
                <option value="weekend">Weekend</option>
              </select>
            </div>

            <button
              type="submit"
              aria-label="Find runs"
              className="inline-flex min-h-14 items-center justify-center rounded-lg bg-[#f47b2a] text-background shadow-lg shadow-[#f47b2a]/20 transition duration-200 hover:bg-[#ffc68f] hover:shadow-[#f47b2a]/30 focus:outline-none focus:ring-2 focus:ring-[#f47b2a]/50"
            >
              <SearchIcon className="h-6 w-6" />
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#A8A8A8]">
            <span className="font-semibold text-cream/78">Popular:</span>
            {popularLocations.map((area) => (
              <Link
                key={area}
                href={`/runs?location=${encodeURIComponent(area)}&availability=upcoming`}
                className="rounded-full border border-[#3d332c] bg-[#101010]/60 px-4 py-2 font-medium text-cream/76 transition duration-200 hover:border-court/70 hover:bg-court/10 hover:text-court-200 focus:outline-none focus:ring-2 focus:ring-court/35"
              >
                {area}
              </Link>
            ))}
          </div>
        </div>

        <section className="relative mt-16 min-h-[32rem] overflow-hidden rounded-xl border border-[#3a3029] bg-[#131313] p-6 shadow-2xl shadow-black/20 transition duration-200 hover:border-court/30 sm:p-8 lg:mt-20 lg:p-12">
          <Image
            src="/torontoSkyline.avif"
            alt=""
            fill
            sizes="(min-width: 1280px) 80rem, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#050505]/55" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#101010_0%,rgba(16,16,16,0.88)_32%,rgba(16,16,16,0.56)_68%,rgba(16,16,16,0.34)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,16,0.1)_0%,rgba(16,16,16,0.08)_52%,#101010_100%)]" />

          <div className="relative z-10 flex min-h-[24rem] flex-col justify-center py-3 sm:py-5 lg:py-6">
            <h2 className="max-w-4xl text-4xl font-semibold tracking-normal text-[#F4F4F4] sm:text-5xl lg:text-6xl">
              What you can filter
            </h2>

            <div className="mt-10 grid gap-8 sm:mt-12 sm:grid-cols-3 sm:gap-0">
              {filterFeatures.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className={`sm:px-7 lg:px-9 ${index === 0 ? "sm:pl-0" : ""} ${
                      index > 0 ? "sm:border-l sm:border-white/14" : ""
                    }`}
                  >
                    <Icon className="h-9 w-9 text-court-200" />
                    <h3 className="mt-6 text-xl font-semibold text-[#F4F4F4]">
                      {feature.label}
                    </h3>
                    <p className="mt-3 max-w-64 text-base leading-7 text-[#d2c8bf]">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </section>
    </main>
  );
}

type IconProps = {
  className?: string;
};

function LocationIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m20 20-4.5-4.5m2-5A7.5 7.5 0 1 1 2.5 10.5a7.5 7.5 0 0 1 15 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
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

function CalendarIcon({ className }: IconProps) {
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
        strokeWidth="1.8"
      />
      <path
        d="M9 13h3v3H9z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
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
