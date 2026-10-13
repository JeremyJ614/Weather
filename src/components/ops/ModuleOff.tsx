import { Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Shown in place of a module the owner has switched off. */
export function ModuleOff({ label }: { label: string }) {
  return (
    <Card className="grid gap-2 text-center">
      <Wrench className="mx-auto size-6 text-accent" aria-hidden />
      <p className="font-bold">{label} is down for maintenance</p>
      <p className="text-sm text-muted">
        It will be back shortly. Thanks for your patience.
      </p>
    </Card>
  );
}
