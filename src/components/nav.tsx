"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Store } from "lucide-react";
import { cn } from "./ui";

const LINKS = [
  { href: "/", label: "Disputes", icon: Inbox, match: (p: string) => p === "/" || p.startsWith("/disputes") },
  { href: "/store", label: "Demo store", icon: Store, match: (p: string) => p.startsWith("/store") },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-zinc-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium",
              active ? "bg-zinc-900 text-white" : "text-zinc-600",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
