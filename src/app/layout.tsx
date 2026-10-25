import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandMark } from "./_components/brand";
import { HeaderLink } from "./_components/header-link";
import { navButtonClass } from "./_components/nav-button";
import { SiteFooter } from "./_components/site-footer";
import {
  ClerkProvider,
  SignInButton,
  UserButton,
  Show,
} from "@clerk/nextjs";

// The design spec names Inter for the whole site, so it is now --font-sans
// rather than a one-component exception. Geist Sans and Geist Mono are gone:
// nothing in the app ever applied `font-mono`, and leaving Geist Sans loaded
// would have meant /runs and /account rendering in a different typeface from
// the home page.
//
// The weight list is exactly what the spec calls for -- 400 body, 500 the
// "When" select, 600 nav, 700 the headline, 800 the FIND RUNS label. Each
// weight is a separate download, so this list stays pruned to what is used.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "OpenGym",
  description: "Find, join, and create indoor basketball runs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col text-foreground">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/92 shadow-[0_1px_22px_rgba(20,20,20,0.06)] backdrop-blur-xl">
            {/*
              py-[6px], not py-3. The brand is the tallest thing in this bar by
              some margin -- 80px against the nav's 50 -- so the mark's height
              and the vertical padding are the only two terms in the header's
              height, and they trade directly against each other. Halving the
              padding is what buys the mark its full size inside a bar a sixth
              shorter than it used to be. The nav still has 15px of air each
              side of its 50px controls, so nothing else feels the squeeze.
            */}
            <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-[6px] sm:px-6">
              <Link
                href="/"
                aria-label="OpenGym home"
                /*
                  flex, not the default block: the mark is wrapped in an
                  inline-flex span, which sat in an inline formatting context
                  and picked up ~6px of descender space under it. That made the
                  link 86px tall around an 80px image, and since the brand is
                  the tallest thing in the header, those 6px were setting the
                  header's height for nothing.
                */
                className="flex rounded-md transition duration-200 hover:opacity-90 focus:outline-none focus-visible:outline-none"
              >
                <BrandMark />
              </Link>

              {/* 15px: half the 30px this used to be. That 30px dated from
                  when the buttons cast a 4px diagonal shadow which ate into
                  the gap; the shadow is straight down now, so the full value
                  reads as air and the pair looked adrift from each other.
                  Narrow screens stay tighter on purpose. */}
              <nav className="flex shrink-0 items-center gap-2 text-sm sm:gap-[15px]">
                <HeaderLink href="/runs">Runs</HeaderLink>

                {/* The slot reserves height only, not width. Clerk resolves the
                    session on the client, so this keeps the header from
                    shifting vertically as auth state arrives; the height covers
                    the 46px control plus the buttons' 4px offset shadow.
                    Reserving the wider sign-in width as well would leave a
                    permanent ~50px gap beside the avatar for every signed-in
                    user, which is the worse of the two artefacts. */}
                <div className="flex h-[50px] shrink-0 items-center justify-end">
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className={navButtonClass("solid")}>Sign in</button>
                    </SignInButton>
                  </Show>

                  <Show when="signed-in">
                    {/* Optical, not geometric, centring. The buttons drop a 4px
                        shadow below their box, so the mass the eye reads is
                        centred 2px lower than the box is. The avatar casts no
                        shadow, so centring it on the box leaves it looking
                        high; half the shadow offset puts it right. */}
                    <div className="translate-y-[3px]">
                      <UserButton
                        userProfileUrl="/account"
                        userProfileMode="navigation"
                      />
                    </div>
                  </Show>
                </div>
              </nav>
            </div>
          </header>

          {/*
            `flex-1` only became meaningful once <body> was made a flex column
            above; before that it was inert. It is what pushes the footer to
            the bottom of the viewport on short pages such as /sign-in rather
            than leaving it floating mid-screen.
          */}
          <div className="flex flex-1 flex-col">{children}</div>

          <SiteFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}
