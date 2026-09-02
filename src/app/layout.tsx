import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandLockup } from "./_components/brand";
import { HeaderLink } from "./_components/header-link";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full text-cream">
          <header className="sticky top-0 z-30 border-b border-[#2a211b] bg-[#0d0d0d]/92 shadow-[0_1px_22px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <Link
                href="/"
                aria-label="OpenGym home"
                className="relative rounded-md transition duration-200 hover:opacity-90 focus:outline-none focus-visible:outline-none"
              >
                <BrandLockup />
                <span className="absolute -bottom-3 left-12 hidden h-px w-24 bg-gradient-to-r from-court via-court/70 to-transparent sm:block" />
              </Link>

              <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-3">
                <HeaderLink href="/runs">Runs</HeaderLink>

                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="shrink-0 whitespace-nowrap rounded-lg border border-court bg-court px-3 py-2 font-semibold text-white shadow-lg shadow-court/15 transition duration-200 hover:bg-transparent hover:text-white hover:shadow-none focus:outline-none focus:ring-2 focus:ring-court/45 sm:px-4">
                      Sign in
                    </button>
                  </SignInButton>

                  <SignUpButton mode="modal">
                    <button className="shrink-0 whitespace-nowrap rounded-md bg-court px-3 py-2 font-semibold text-background shadow-lg shadow-court/20 transition duration-200 hover:bg-court-200 hover:shadow-court/35 focus:outline-none focus:ring-2 focus:ring-court/50 sm:px-3.5">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>

                <Show when="signed-in">
                  <HeaderLink href="/account">Account</HeaderLink>
                  <UserButton />
                </Show>
              </nav>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
