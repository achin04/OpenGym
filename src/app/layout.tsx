import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
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
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full bg-zinc-950 text-white">
          <header className="border-b border-white/10">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold">
                OpenGym
              </Link>

              <nav className="flex items-center gap-4 text-sm">
                <Link href="/runs" className="text-zinc-300 hover:text-white">
                  Runs
                </Link>

                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="text-zinc-300 hover:text-white">
                      Sign in
                    </button>
                  </SignInButton>

                  <SignUpButton mode="modal">
                    <button className="rounded-md bg-emerald-400 px-3 py-2 font-medium text-zinc-950 hover:bg-emerald-300">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>

                <Show when="signed-in">
                  <Link href="/account" className="text-zinc-300 hover:text-white">
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
