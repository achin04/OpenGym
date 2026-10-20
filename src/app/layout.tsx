import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandLockup } from "./_components/brand";
import { HeaderLink } from "./_components/header-link";
import { navButtonClass } from "./_components/nav-button";
import {
  ClerkProvider,
  SignInButton,
  UserButton,
  Show,
} from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Loaded for the nav buttons, whose Figma spec is Inter Medium 15/18, and for
// the brand lockup's label, which matches them at semibold. Everything else on
// the page stays on Geist.
const inter = Inter({
  variable: "--font-inter-src",
  subsets: ["latin"],
  weight: ["500", "600"],
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
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}>
        <body className="min-h-full text-foreground">
          <header className="sticky top-0 z-30 border-b border-[#e6ded2] bg-[#faf8f4]/92 shadow-[0_1px_22px_rgba(15,16,19,0.06)] backdrop-blur-xl">
            <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <Link
                href="/"
                aria-label="OpenGym home"
                className="rounded-md transition duration-200 hover:opacity-90 focus:outline-none focus-visible:outline-none"
              >
                <BrandLockup />
              </Link>

              {/* 30px: the Figma export's 18px, widened by two thirds. The
                  buttons' 4px offset shadow eats into it, leaving 26px of
                  visible air. Narrow screens stay tighter on purpose. */}
              <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-[30px]">
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

          <div className="flex-1">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
