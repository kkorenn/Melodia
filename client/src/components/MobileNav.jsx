import { NavLink } from "react-router-dom";
import {
  Activity,
  Clock3,
  Disc3,
  LibraryBig,
  ListMusic,
  Mic2,
  Settings,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { buttonVariants } from "./ui/button";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Library", icon: LibraryBig },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/artists", label: "Artists", icon: Mic2 },
  { to: "/albums", label: "Albums", icon: Disc3 },
  { to: "/rediscover", label: "Rediscover", icon: Sparkles },
  { to: "/active-artists", label: "Active", icon: Activity },
  { to: "/recently-played", label: "Played", icon: Clock3 },
  { to: "/most-played", label: "Most", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function MobileNav() {
  return (
    <nav className="border-b border-[color:var(--border)] bg-[color:var(--bg-main)] px-3 py-2 md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {navItems.map((item) => (
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
