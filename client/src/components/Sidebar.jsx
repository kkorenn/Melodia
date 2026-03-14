import { NavLink } from "react-router-dom";
import {
  Activity,
  Clock3,
  Disc3,
  LibraryBig,
  ListMusic,
  Mic2,
  Music4,
  Settings,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { buttonVariants } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/appStore";

const navItems = [
  { to: "/", label: "Library", icon: LibraryBig },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/artists", label: "Artists", icon: Mic2 },
  { to: "/albums", label: "Albums", icon: Disc3 },
  { to: "/rediscover", label: "Rediscover", icon: Sparkles },
  { to: "/active-artists", label: "Active Artists", icon: Activity },
  { to: "/recently-played", label: "Recently Played", icon: Clock3 },
  { to: "/most-played", label: "Most Played", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const appName = useAppStore((state) => state.appName);

  return (
    <aside className="hidden h-full w-64 flex-col border-r border-[color:var(--border)] bg-panel px-4 py-6 md:flex">
      <Card className="mb-8 bg-panelSoft/35">
        <CardHeader className="space-y-1.5 p-4">
          <CardDescription className="text-xs">Self-hosted player</CardDescription>
          <CardTitle className="flex items-center gap-2 text-xl">
          <Music4 className="h-6 w-6 text-accent" strokeWidth={2.2} aria-hidden="true" />
          <span>{appName}</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                buttonVariants({
                  variant: isActive ? "default" : "ghost",
                  size: "default"
                }),
                "justify-start rounded-xl text-sm"
              )
            }
          >
            <span className="inline-flex items-center gap-2">
              <item.icon className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              <span>{item.label}</span>
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
