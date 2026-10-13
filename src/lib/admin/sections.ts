/** Admin panel sections. `phase` is where a section is built; built ones have `href`. */
export type AdminSection = {
  id: string;
  label: string;
  icon: string;
  phase: string;
  href?: string;
  founderOnly?: boolean;
  /** Permission that opens it, when it differs from `id`. */
  perm?: string;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "admins",
    label: "Admins & access",
    icon: "ShieldCheck",
    phase: "11",
    href: "/admin/admins",
    founderOnly: true,
  },
  {
    id: "audit",
    label: "Audit log",
    icon: "ScrollText",
    phase: "11",
    href: "/admin/audit",
  },
  {
    id: "storage",
    label: "Storage watchdog",
    icon: "HardDrive",
    phase: "11",
    href: "/admin/storage",
  },
  {
    id: "releases",
    label: "Release notes",
    icon: "Rocket",
    phase: "17",
    href: "/admin/releases",
    perm: "news",
  },
  {
    id: "menus",
    label: "Menu & theme defaults",
    icon: "PanelsTopLeft",
    phase: "07",
  },
  {
    id: "news",
    label: "News & announcements",
    icon: "Newspaper",
    phase: "12",
    href: "/admin/news",
  },
  {
    id: "members",
    label: "Members & referrals",
    icon: "Users",
    phase: "13",
    href: "/admin/members",
  },
  {
    id: "signup-form",
    label: "Signup form",
    icon: "ClipboardList",
    phase: "13",
  },
  {
    id: "errors",
    label: "Error inbox",
    icon: "Bug",
    phase: "13",
    href: "/admin/errors",
  },
  {
    id: "sms",
    label: "Text requests & brief report",
    icon: "MessageSquare",
    phase: "21",
    href: "/admin/sms",
  },
  {
    id: "trivia",
    label: "Daily Trivia",
    icon: "CircleHelp",
    phase: "27",
    href: "/admin/trivia",
  },
  {
    id: "leaderboard",
    label: "Leaderboard & champions",
    icon: "Trophy",
    phase: "28",
    href: "/admin/leaderboard",
  },
  {
    id: "polls",
    label: "Weekly polls",
    icon: "Vote",
    phase: "29",
    href: "/admin/polls",
  },
  { id: "cameras", label: "Traffic cameras", icon: "Cctv", phase: "48" },
  { id: "engines", label: "Engine preview", icon: "Cpu", phase: "60b" },
  {
    id: "disaster",
    label: "Disaster response inbox",
    icon: "HeartHandshake",
    phase: "61",
  },
];

export const sectionIds = new Set(
  ADMIN_SECTIONS.filter((s) => !s.perm).map((s) => s.id),
);
