import { NavLink } from "react-router-dom";
import { buttonVariants } from "./ui/button";
import { cn } from "../lib/utils";
import { NAV_ITEMS } from "../lib/navigation";

export function MobileNav() {
  return (
    <nav className="border-b border-[color:var(--border)] bg-[color:var(--bg-main)] px-3 py-2 md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                buttonVariants({
                  variant: isActive ? "default" : "secondary",
                  size: "sm"
                }),
                "shrink-0 gap-1.5 rounded-xl text-xs"
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            <span>{item.mobileLabel || item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
