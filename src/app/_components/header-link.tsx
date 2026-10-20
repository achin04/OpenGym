"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navButtonClass } from "./nav-button";

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
      className={navButtonClass("outline", { pressed: isActive })}
    >
      {children}
    </Link>
  );
}
