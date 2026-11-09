"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, GraduationCap, Settings, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", key: "home", icon: UsersRound, manager: false },
  { href: "/schedule", key: "schedule", icon: CalendarDays, manager: false },
  { href: "/exams", key: "exams", icon: GraduationCap, manager: false },
  { href: "/settings", key: "settings", icon: Settings, manager: true },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar on phones, vertical list in the desktop sidebar. */
export function AppNav({ variant, canManage }: { variant: "bottom" | "side"; canManage: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("menu")}
      className={cn(
        variant === "bottom"
          ? "fixed inset-x-0 bottom-0 z-40 grid grid-flow-col auto-cols-fr border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
          : "hidden flex-col gap-1 md:flex",
      )}
    >
      {ITEMS.filter((item) => canManage || !item.manager).map(({ href, key, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              variant === "bottom"
                ? "flex h-16 flex-col items-center justify-center gap-1 text-xs"
                : "flex h-10 items-center gap-3 rounded-md px-3 text-sm",
              active ? "text-primary font-semibold" : "text-muted-foreground",
              variant === "side" && active && "bg-accent",
              variant === "side" && !active && "hover:bg-accent/60",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
