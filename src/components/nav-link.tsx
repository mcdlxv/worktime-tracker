"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const isCurrent = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? "font-medium underline decoration-2 underline-offset-8"
          : "text-muted hover:text-ink"
      }
    >
      {children}
    </Link>
  );
}
