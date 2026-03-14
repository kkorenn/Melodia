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

export const NAV_ITEMS = [
  { to: "/", label: "Library", mobileLabel: "Library", icon: LibraryBig },
  { to: "/playlists", label: "Playlists", mobileLabel: "Playlists", icon: ListMusic },
  { to: "/artists", label: "Artists", mobileLabel: "Artists", icon: Mic2 },
  { to: "/albums", label: "Albums", mobileLabel: "Albums", icon: Disc3 },
  { to: "/rediscover", label: "Rediscover", mobileLabel: "Rediscover", icon: Sparkles },
  { to: "/active-artists", label: "Active Artists", mobileLabel: "Active", icon: Activity },
  { to: "/recently-played", label: "Recently Played", mobileLabel: "Played", icon: Clock3 },
  { to: "/most-played", label: "Most Played", mobileLabel: "Most", icon: TrendingUp },
  { to: "/settings", label: "Settings", mobileLabel: "Settings", icon: Settings }
];
