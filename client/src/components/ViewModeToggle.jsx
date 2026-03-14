import { Grid2x2, Grid3x3, List } from "lucide-react";
import { cn } from "../lib/utils";
import { withViewTransition } from "../lib/viewTransitions";

export function ViewModeToggle({ mode, gridSize = "large", onChange }) {
  const selected = mode === "list" ? "list" : gridSize === "small" ? "small" : "large";
  const options = [
    { key: "list", label: "List", icon: List, onSelect: () => onChange("list") },
    {
      key: "small",
      label: "Small Grid",
      icon: Grid2x2,
      onSelect: () => onChange("grid", "small")
    },
    {
      key: "large",
      label: "Large Grid",
      icon: Grid3x3,
      onSelect: () => onChange("grid", "large")
    }
  ];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === selected));
  const indicatorShapeClass =
    selectedIndex === 0
      ? "rounded-l-[10px] rounded-r-[5px]"
      : selectedIndex === 1
        ? "rounded-[5px]"
        : "rounded-r-[10px] rounded-l-[5px]";

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="relative inline-grid grid-cols-3 rounded-xl border border-[color:var(--border)] bg-panel p-0.5 text-sm"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 z-[1] w-[calc((100%-0.25rem)/3)] border border-[color:var(--border)] bg-panelSoft/95 shadow-sm transition-transform duration-300 ease-out",
          indicatorShapeClass
        )}
        style={{
          transform: `translateX(${selectedIndex * 100}%)`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)"
        }}
      />

      <span aria-hidden="true" className="pointer-events-none absolute bottom-2 top-2 left-1/3 z-0 w-px -translate-x-1/2 bg-[color:var(--border)]" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2 top-2 left-2/3 z-0 w-px -translate-x-1/2 bg-[color:var(--border)]" />

      {options.map((option, index) => {
        const isActive = selected === option.key;
        const Icon = option.icon;

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            onClick={() => withViewTransition(option.onSelect)}
            className={cn(
              "relative z-10 inline-flex h-8 items-center justify-center gap-1.5 px-3.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
              index === 0 && "rounded-l-[10px]",
              index === 1 && "rounded-[5px]",
              index === 2 && "rounded-r-[10px]",
              isActive ? "text-text" : "text-textSoft hover:text-text"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
