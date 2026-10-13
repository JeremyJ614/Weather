/** Admin panel sections. `phase` is where a section is built; built ones have `href`. */
export type AdminSection = {
  id: string;
  label: string;
  icon: string;
  phase: string;
  href?: string;
  founderOnly?: boolean;
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
  { id: "members", label: "Members & referrals", icon: "Users", phase: "13" },
  {
    id: "signup-form",
    label: "Signup form",
    icon: "ClipboardList",
    phase: "13",
  },
  { id: "errors", label: "Error log", icon: "Bug", phase: "13" },
  { id: "sms", label: "Text requests", icon: "MessageSquare", phase: "21" },
  { id: "trivia", label: "Trivia & points", icon: "CircleHelp", phase: "27" },
  { id: "leaderboard", label: "Leaderboard", icon: "Trophy", phase: "28" },
  { id: "polls", label: "Weekly polls", icon: "Vote", phase: "29" },
  { id: "cameras", label: "Traffic cameras", icon: "Cctv", phase: "48" },
  { id: "engines", label: "Engine preview", icon: "Cpu", phase: "60b" },
  {
    id: "disaster",
    label: "Disaster response inbox",
    icon: "HeartHandshake",
    phase: "61",
  },
];

export const sectionIds = new Set(ADMIN_SECTIONS.map((s) => s.id));
