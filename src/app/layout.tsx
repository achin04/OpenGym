import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandLockup } from "./_components/brand";
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
          <header className="sticky top-0 z-30 border-b border-line bg-background/86 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <Link href="/" aria-label="OpenGym home">
                <BrandLockup />
              </Link>

              <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-3">
                <Link
                  href="/runs"
                  className="shrink-0 rounded-md px-2 py-2 font-medium text-cream/70 transition hover:bg-white/5 hover:text-cream sm:px-3"
                >
                  Runs
                </Link>

                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 font-medium text-cream/70 transition hover:bg-white/5 hover:text-cream sm:px-3">
                      Sign in
                    </button>
                  </SignInButton>

                  <SignUpButton mode="modal">
                    <button className="shrink-0 whitespace-nowrap rounded-md bg-court px-2.5 py-2 font-semibold text-background transition hover:bg-court-200 sm:px-3">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>

                <Show when="signed-in">
                  <Link
                    href="/account"
                    className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 font-medium text-cream/70 transition hover:bg-white/5 hover:text-cream sm:px-3"
                  >
                    Account
                  </Link>
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
