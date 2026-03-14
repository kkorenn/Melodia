import { Lock } from "lucide-react";
import { cn } from "../lib/utils";

export function SettingsLockedNotice({ children, className }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-panelSoft/50 px-3 py-2 text-xs text-textSoft",
        className
      )}
    >
      <Lock className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
