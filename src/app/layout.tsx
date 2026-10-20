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

// Loaded only for the nav buttons, whose Figma spec is Inter Medium 15/18.
// Everything else on the page stays on Geist.
const inter = Inter({
  variable: "--font-inter-src",
  subsets: ["latin"],
  weight: ["500"],
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
                className="relative rounded-md transition duration-200 hover:opacity-90 focus:outline-none focus-visible:outline-none"
              >
                <BrandLockup />
                <span className="absolute -bottom-3 left-12 hidden h-px w-24 bg-gradient-to-r from-court via-court/70 to-transparent sm:block" />
              </Link>

              {/* 18px matches the gap between the two buttons in the Figma export.
                  The buttons' 4px offset shadow eats into it, leaving 14px of
                  visible air. */}
              <nav className="flex shrink-0 items-center gap-2 text-sm sm:gap-[18px]">
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
                    <UserButton
                      userProfileUrl="/account"
                      userProfileMode="navigation"
                    />
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
