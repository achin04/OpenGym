"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderLinkProps = {
  children: React.ReactNode;
  href: string;
};

export function HeaderLink({ children, href }: HeaderLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`relative shrink-0 rounded-lg border border-court px-3 py-2 font-semibold text-white shadow-lg shadow-court/15 transition duration-200 hover:bg-transparent hover:text-white hover:shadow-none focus:outline-none focus:ring-2 focus:ring-court/45 sm:px-4 ${
        isActive
          ? "bg-court after:absolute after:bottom-[-13px] after:left-3 after:right-3 after:h-px after:bg-court"
          : "bg-court"
      }`}
    >
      {children}
    </Link>
  );
}
