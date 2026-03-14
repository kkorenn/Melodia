import { NavLink } from "react-router-dom";
import { Github, Music4 } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { cn } from "../lib/utils";
import { NAV_ITEMS } from "../lib/navigation";
import { useAppStore } from "../store/appStore";

export function Sidebar() {
  const appName = useAppStore((state) => state.appName);

  return (
    <aside className="hidden h-full w-64 flex-col border-r border-[color:var(--border)] bg-panel px-4 py-6 md:flex">
      <Card className="mb-8 bg-panelSoft/35">
        <CardHeader className="relative space-y-1.5 p-4">
          <a
            href="https://github.com/kkorenn/Melodia"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Melodia on GitHub"
            className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-textSoft transition-colors hover:bg-panel hover:text-text"
          >
            <Github className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </a>
          <CardDescription className="text-xs">Self-hosted player</CardDescription>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Music4 className="h-6 w-6 text-accent" strokeWidth={2.2} aria-hidden="true" />
            <span>{appName}</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
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
