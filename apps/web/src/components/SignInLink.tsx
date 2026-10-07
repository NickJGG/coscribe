"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Sign in", coming back to this page afterwards. */
export function SignInLink({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={className}>
      Sign in
    </Link>
  );
}
