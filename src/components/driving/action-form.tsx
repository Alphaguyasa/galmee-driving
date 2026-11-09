"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/actions/driving";
import { Button } from "@/components/ui/button";

/** Form bound to a server action: shows the translated error and a success note. */
export function ActionForm({
  action,
  submitLabel,
  doneLabel,
  variant = "default",
  size = "lg",
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  doneLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  size?: "lg" | "sm";
  className?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("errors");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "grid gap-3"}>
      {children}
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      ) : null}
      {state?.done && doneLabel ? (
        <p role="status" className="text-sm text-muted-foreground">
          {doneLabel}
        </p>
      ) : null}
      <Button type="submit" size={size} variant={variant} disabled={pending} aria-busy={pending} className={size === "sm" ? "h-11 min-w-16" : undefined}>
        {submitLabel}
      </Button>
    </form>
  );
}
