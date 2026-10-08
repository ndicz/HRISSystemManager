"use client";

import { useState, useTransition } from "react";
import { formatActionError } from "@/lib/errors";

// For buttons that fire a server action straight from a click. Without a
// catch, a failed action (a validation error, a closed period, …) falls
// through to the error boundary and the whole page shows "This page
// couldn't load"; this keeps the page up and gives the message back to
// show next to the button.
export function useActionRunner() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(fn: () => Promise<unknown>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(formatActionError(err));
      }
    });
  }
  return { pending, error, run };
}
