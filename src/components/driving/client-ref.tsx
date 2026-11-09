"use client";

import { useState } from "react";

/** A fresh id per rendered form: a repeated submit of the same form cannot record twice. */
export function ClientRef() {
  const [ref] = useState(() => crypto.randomUUID());
  return <input type="hidden" name="clientRef" value={ref} />;
}
