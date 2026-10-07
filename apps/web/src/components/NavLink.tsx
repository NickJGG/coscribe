"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A header link marked current on its own page and every page beneath it. */
export function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
