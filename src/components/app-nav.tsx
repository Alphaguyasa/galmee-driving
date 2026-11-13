"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, GraduationCap, Settings, UsersRound } from "lucide-react";
import { BottomNav } from "@/components/galmee/bottom-nav";

const ITEMS = [
  { href: "/", key: "home", icon: UsersRound, manager: false },
  { href: "/schedule", key: "schedule", icon: CalendarDays, manager: false },
  { href: "/exams", key: "exams", icon: GraduationCap, manager: false },
  { href: "/settings", key: "settings", icon: Settings, manager: true },
] as const;

/** The driving school's destinations in the shared Galmee nav; setup is for managers. */
export function AppNav({ variant, canManage }: { variant: "bottom" | "side"; canManage: boolean }) {
  const t = useTranslations("nav");
  return (
    <BottomNav
      variant={variant}
      menuLabel={t("menu")}
      items={ITEMS.filter((item) => canManage || !item.manager).map(({ href, key, icon }) => ({
        href,
        label: t(key),
        icon,
      }))}
    />
  );
}
