"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { refreshNow } from "./actions";

export function Refresh() {
  const [state, action, pending] = useActionState(refreshNow, null);
  return (
    <form action={action} className="grid gap-2">
      <Button type="submit" disabled={pending}>
        <RefreshCw
          className={`size-4 ${pending ? "animate-spin" : ""}`}
          aria-hidden
        />
        {pending ? "Collecting…" : "Collect now"}
      </Button>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
