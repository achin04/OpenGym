import Link from "next/link";
import { BrandMark } from "./_components/brand";

const popularLocations = ["Toronto", "Etobicoke", "North York", "Scarborough"];

const filterFeatures = [
  {
    icon: AreaIcon,
    label: "Area fit",
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
    description: "See level, price, and capacity",
  },
];

const valueProps = [
  {
    icon: TargetIcon,
    label: "Fast matching",
    description: "We prioritize runs that start soon",
  },
  {
    icon: CourtIcon,
    label: "Court vibes",
    description: "Indoor courts and good vibes",
  },
  {
    icon: RouteIcon,
    label: "Play your way",
    description: "All levels welcome, competitive or chill",
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
              surfaces the closest-fit drop-in runs first.
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

        <section className="mt-16 rounded-xl border border-[#3a3029] bg-[#131313]/95 p-6 shadow-2xl shadow-black/20 transition duration-200 hover:border-court/30 sm:p-8 lg:mt-20 lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-10 lg:p-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal text-[#F4F4F4]">
              What you can filter
            </h2>

            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-0">
              {filterFeatures.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className={`md:px-6 ${index === 0 ? "md:pl-0" : ""} ${
                      index > 0 ? "md:border-l md:border-[#353535]" : ""
                    }`}
                  >
                    <Icon className="h-8 w-8 text-court-200" />
                    <h3 className="mt-8 text-base font-semibold text-[#F4F4F4]">
                      {feature.label}
                    </h3>
                    <p className="mt-3 max-w-40 text-sm leading-6 text-[#A8A8A8]">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 lg:mt-0">
            <MapPreview />
          </div>
        </section>

        <section className="mt-12 grid gap-8 border-t border-[#2d251f] pt-12 md:grid-cols-3 md:gap-0">
          {valueProps.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className={`md:px-12 ${index === 0 ? "md:pl-0" : ""} ${
                  index > 0 ? "md:border-l md:border-[#353535]" : ""
                }`}
              >
                <Icon className="h-10 w-10 text-court-200" />
                <h2 className="mt-8 text-xl font-semibold text-[#F4F4F4]">
                  {item.label}
                </h2>
                <p className="mt-3 max-w-52 text-base leading-7 text-[#A8A8A8]">
                  {item.description}
                </p>
              </div>
            );
          })}
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

function TargetIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 20 20 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CourtIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 18h16M7 18c.7-3.3 2.4-5 5-5s4.3 1.7 5 5M9 8a3 3 0 1 1 6 0c0 1.7-1.3 5-3 5S9 9.7 9 8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RouteIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 18h12V6H6v12Zm3-3 6-6m0 0h-4m4 0v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MapPreview() {
  return (
    <div className="relative h-72 overflow-hidden rounded-xl border border-[#343434] bg-[#0d0f10] shadow-inner shadow-black/40 sm:h-80 lg:h-full lg:min-h-72">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 520 360"
      >
        <defs>
          <pattern
            id="map-grid"
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M34 0H0v34"
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="1"
            />
          </pattern>
          <filter id="pin-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="520" height="360" fill="#0d0f10" />
        <rect width="520" height="360" fill="url(#map-grid)" opacity="0.9" />

        <path
          d="M360 360c14-88 82-135 160-132v132H360Z"
          fill="#0d2d34"
          opacity="0.8"
        />
        <path
          d="M-20 254c108-36 194-50 300-80s176-66 268-96"
          fill="none"
          stroke="#494949"
          strokeWidth="2"
        />
        <path
          d="M-26 181c104 51 202 82 315 111 69 18 146 35 256 74"
          fill="none"
          stroke="#3b3b3b"
          strokeWidth="2"
        />
        <path
          d="M-30 300c89-22 163-49 244-87 93-43 178-69 344-107"
          fill="none"
          stroke="#303030"
          strokeWidth="2"
        />
        <path
          d="M72 -22 32 382M188 -20 122 382M275 -24 236 383"
          fill="none"
          stroke="#194846"
          strokeWidth="2"
        />
        <path
          d="M56 48h160m-98 61h190m-284 66h140m155 61h170m-375 55h184"
          fill="none"
          stroke="#232323"
          strokeWidth="10"
        />
        <path
          d="M56 48h160m-98 61h190m-284 66h140m155 61h170m-375 55h184"
          fill="none"
          stroke="#454545"
          strokeDasharray="10 16"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M120 218c59-30 106-46 160-58 41-9 82-26 123-55"
          fill="none"
          stroke="#f47b2a"
          strokeDasharray="6 10"
          strokeLinecap="round"
          strokeWidth="2.5"
          opacity="0.75"
        />

        <text fill="#6d6d6d" fontSize="12" fontWeight="600" x="46" y="78">
          Queen St
        </text>
        <text fill="#6d6d6d" fontSize="12" fontWeight="600" x="335" y="226">
          Parkside
        </text>
        <text fill="#5b7675" fontSize="12" fontWeight="600" x="174" y="332">
          River path
        </text>
      </svg>

      <MapPin className="left-[28%] top-[42%]" />
      <MapPin className="left-[66%] top-[24%]" />
      <MapPin className="left-[84%] top-[72%]" />

      <span className="absolute left-[52%] top-[58%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-500/25 shadow-lg shadow-blue-500/20">
        <span className="h-7 w-7 rounded-full border-2 border-blue-200 bg-blue-500 shadow-lg shadow-blue-500/35" />
      </span>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0,rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.46)_100%)]" />
    </div>
  );
}

function MapPin({ className }: IconProps) {
  return (
    <span
      className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-court/15 ${className}`}
    >
      <svg
        aria-hidden="true"
        className="h-12 w-12 drop-shadow-[0_8px_14px_rgba(244,123,42,0.28)]"
        fill="none"
        viewBox="0 0 48 48"
      >
        <path
          d="M24 43s12-10.3 12-21a12 12 0 0 0-24 0c0 10.7 12 21 12 21Z"
          fill="#f47b2a"
        />
        <circle cx="24" cy="22" fill="#151515" r="4.5" />
      </svg>
    </span>
  );
}
