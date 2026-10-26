import Link from "next/link";
import { BrandMark } from "./brand";

/**
 * The site footer.
 *
 * Deliberately small: it links only to pages that exist. There is no /about,
 * /privacy or /terms yet, and a footer full of dead links is worse than a
 * short one.
 *
 * The block is --foreground rather than pure #000 so it is the same ink as
 * every border and hard shadow on the site; against the cream page it reads as
 * black, and it ends the page without needing a divider of its own.
 *
 * Everything inside it inverts: the lockup swaps to the light asset, the text
 * is the page background colour, and link hover goes to the accent orange
 * because --link-hover is a dark brown that disappears here.
 */
const footerLinks = [
  { href: "/runs", label: "Runs" },
  { href: "/runs/new", label: "Create a run" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-foreground text-background">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-10 gap-y-6 px-6 py-10">
        <Link
          href="/"
          aria-label="OpenGym home"
          className="rounded-md transition duration-200 hover:opacity-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
        >
          <BrandMark className="h-16" priority={false} variant="inverse" />
        </Link>

        <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[15px] font-medium">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md text-background transition-colors duration-150 hover:text-court focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/*
          Computed rather than hardcoded so it cannot quietly go stale. The
          home page is static, so this is evaluated when the page is rendered
          -- fine for a copyright line, and the alternative (a hardcoded year)
          is wrong every January.
        */}
        <p className="text-[15px] text-background/60">
          &copy; {new Date().getFullYear()} OpenGym
        </p>
      </div>
    </footer>
  );
}
