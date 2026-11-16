/**
 * SSWX section (owner, 2026-11-04): the members' area for StormSync Media's own team. Roster,
 * Application Center and their settings are documents the server keeps in a private Storage
 * bucket (lib/sswx/store.ts); this file holds their shapes and defaults, safe for the client.
 */
export type Department = { id: string; name: string; color: string };
export type Position = {
  id: string;
  name: string;
  dept: string;
  /** Shown when an applicant opens the position in a Position Interest field. */
  about: string;
};
export type RosterMember = {
  id: string;
  name: string;
  city: string;
  state: string;
  /** YYYY-MM-DD; the time served counts up from it. */
  joined: string;
  positions: string[];
};
export type RosterStyle = "tree" | "pulse" | "circuit";
export const ROSTER_STYLES: RosterStyle[] = ["tree", "pulse", "circuit"];
export type Roster = {
  /** In display order; members appear under the department of their first position. */
  departments: Department[];
  positions: Position[];
  members: RosterMember[];
  style: RosterStyle;
  /** One color for every name. */
  nameColor: string;
};

export type FieldType =
  | "short"
  | "paragraph"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "date"
  | "time"
  | "range"
  | "radio"
  | "checkbox"
  | "dropdown"
  | "terms"
  | "yesno"
  | "stars"
  | "referral"
  | "positions"
  | "signature"
  | "social"
  | "section"
  | "page"
  | "rank"
  | "matrix"
  | "emoji"
  | "color"
  | "tags";
export type Field = {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  /** radio, checkbox, dropdown. */
  options?: string[];
  /** radio and checkbox: allow more than one choice. */
  multi?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** terms: the full text shown when the title is opened. */
  terms?: string;
  placeholder?: string;
  /** Show only when an earlier answer equals (or includes) this value. */
  showIf?: { field: string; is: string };
};
export type Application = {
  id: string;
  title: string;
  blurb: string;
  accent: string;
  open: boolean;
  fields: Field[];
  /** A template: never shown to applicants; "New from template" copies it. */
  template?: boolean;
  /** Optional interview booking: slots (YYYY-MM-DDTHH:mm) an applicant can pick. */
  slots?: string[];
  /** Badge awarded when a status marked "award" is set. */
  badge?: string;
};
export type Status = {
  id: string;
  label: string;
  color: string;
  icon?: string;
  /** Lets the applicant edit and resubmit. */
  edit?: boolean;
  /** Opens interview booking (when the application has slots). */
  interview?: boolean;
  /** Awards the application's badge. */
  award?: boolean;
};
export type Social = {
  id: string;
  name: string;
  color: string;
  prefix: string;
  /** A Simple Icons name (cdn.simpleicons.org) or an image link. */
  icon?: string;
};
export const iconSrc = (x: Social) =>
  x.icon?.startsWith("http")
    ? x.icon
    : `https://cdn.simpleicons.org/${x.icon || x.id}/ffffff`;
export type AppCenter = {
  applications: Application[];
  statuses: Status[];
  /** Team Referral Selector names. */
  team: { id: string; name: string }[];
  socials: Social[];
  /** Upgrade ideas the owner ticked (admin → SSWX → Ideas). */
  ideas: string[];
};
export type Answer =
  string | string[] | number | boolean | Record<string, string>;
export type Submission = {
  id: string;
  app: string;
  appTitle: string;
  user: string;
  name: string;
  email: string;
  at: string;
  status: string;
  note: string;
  answers: Record<string, Answer>;
  /** The team's note on single answers (e.g. what to change). */
  fieldNotes?: Record<string, string>;
  /** Messages from the team, shown to the applicant. */
  messages?: { at: string; text: string }[];
  history?: { at: string; status: string }[];
  slot?: string;
};
export type Stats = Record<
  string,
  { views: number; starts: number; done: number }
>;

/** Does a field show, given the answers so far (conditional questions)? */
export function shown(f: Field, a: Record<string, Answer>) {
  if (!f.showIf?.field) return true;
  const v = a[f.showIf.field];
  const want = f.showIf.is.trim().toLowerCase();
  const norm = (x: unknown) => String(x).trim().toLowerCase();
  return Array.isArray(v)
    ? v.some((x) => norm(x) === want)
    : v === true
      ? want === "yes"
      : v === false
        ? want === "no"
        : norm(v ?? "") === want;
}

export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const DEFAULT_ROSTER: Roster = {
  departments: [{ id: "admin", name: "Administration", color: "#f5c542" }],
  positions: [
    {
      id: "board",
      name: "Board of Executives",
      dept: "admin",
      about:
        "Sets StormSync Media's direction and signs off on every department.",
    },
  ],
  members: [
    {
      id: "jay",
      name: "Jay Myers",
      city: "Lakeview",
      state: "Ohio",
      joined: "2025-11-07",
      positions: ["board"],
    },
  ],
  style: "tree",
  nameColor: "#ffffff",
};

/** A closed starter that uses every question type; the owner edits, opens or deletes it. */
const STARTER: Application = {
  id: "starter",
  title: "SSWX Team Application",
  blurb: "Tell us who you are and where you'd fit on the StormSync Media team.",
  accent: "#38bdf8",
  open: false,
  fields: [
    { id: "s1", type: "section", label: "About you" },
    { id: "name", type: "short", label: "Full name", required: true },
    { id: "email", type: "email", label: "Email address", required: true },
    { id: "phone", type: "phone", label: "Phone number" },
    { id: "age", type: "number", label: "Age", min: 13, max: 99 },
    { id: "site", type: "url", label: "Portfolio or channel link" },
    {
      id: "bio",
      type: "paragraph",
      label: "Why do you want to join?",
      required: true,
    },
    { id: "s2", type: "section", label: "Your fit" },
    {
      id: "pos",
      type: "positions",
      label: "Positions you're interested in",
      required: true,
    },
    {
      id: "exp",
      type: "range",
      label: "Weather experience (years)",
      min: 0,
      max: 20,
    },
    {
      id: "skill",
      type: "radio",
      label: "Strongest skill",
      options: ["Forecasting", "Chasing", "Graphics", "Video", "Writing"],
    },
    {
      id: "days",
      type: "checkbox",
      label: "Days you're available",
      options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    {
      id: "region",
      type: "dropdown",
      label: "Region you cover",
      options: ["Plains", "Midwest", "Southeast", "Northeast", "West"],
    },
    { id: "start", type: "date", label: "Earliest start date" },
    { id: "call", type: "time", label: "Best time for a call" },
    { id: "chase", type: "yesno", label: "Have you chased storms before?" },
    { id: "rate", type: "stars", label: "Rate your forecasting confidence" },
    { id: "ref", type: "referral", label: "Who referred you?" },
    { id: "soc", type: "social", label: "Your social profiles" },
    { id: "s3", type: "section", label: "Agreement" },
    {
      id: "terms",
      type: "terms",
      label: "SSWX Code of Conduct",
      required: true,
      terms:
        "Write the code of conduct here in admin → SSWX → Application builder.",
    },
    { id: "sig", type: "signature", label: "Signature", required: true },
  ],
};

export const DEFAULT_CENTER: AppCenter = {
  applications: [STARTER],
  statuses: [
    { id: "received", label: "Received", color: "#94a3b8", icon: "✉" },
    { id: "processing", label: "Processing", color: "#38bdf8", icon: "⟳" },
    {
      id: "interview",
      label: "Interview",
      color: "#a78bfa",
      icon: "☎",
      interview: true,
    },
    {
      id: "modify",
      label: "Requires Modification",
      color: "#f59e0b",
      icon: "✎",
      edit: true,
    },
    { id: "waitlist", label: "Waitlisted", color: "#f472b6", icon: "⏳" },
    {
      id: "accepted",
      label: "Accepted",
      color: "#22c55e",
      icon: "★",
      award: true,
    },
    { id: "rejected", label: "Rejected", color: "#ef4444", icon: "✕" },
  ],
  team: [{ id: "jay", name: "Jay Myers" }],
  socials: [
    { id: "x", name: "X", color: "#000000", prefix: "https://x.com/" },
    {
      id: "facebook",
      name: "Facebook",
      color: "#1877f2",
      prefix: "https://facebook.com/",
    },
    {
      id: "instagram",
      name: "Instagram",
      color: "#e1306c",
      prefix: "https://instagram.com/",
    },
    {
      id: "youtube",
      name: "YouTube",
      color: "#ff0000",
      prefix: "https://youtube.com/@",
    },
    {
      id: "tiktok",
      name: "TikTok",
      color: "#25f4ee",
      prefix: "https://tiktok.com/@",
    },
    { id: "discord", name: "Discord", color: "#5865f2", prefix: "" },
  ],
  ideas: [],
};

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "section", label: "Section heading" },
  { type: "short", label: "Short answer" },
  { type: "paragraph", label: "Paragraph answer" },
  { type: "email", label: "Email address" },
  { type: "phone", label: "Phone number" },
  { type: "number", label: "Numeric quantity" },
  { type: "url", label: "Web address (URL)" },
  { type: "date", label: "Calendar date picker" },
  { type: "time", label: "Time picker" },
  { type: "range", label: "Linear range slider" },
  { type: "radio", label: "Radio circle selector" },
  { type: "checkbox", label: "Checkboxes" },
  { type: "dropdown", label: "Dropdown selector" },
  { type: "terms", label: "Terms agreement" },
  { type: "yesno", label: "Yes / No toggle" },
  { type: "stars", label: "Star rating" },
  { type: "referral", label: "Team referral selector" },
  { type: "positions", label: "Position interest" },
  { type: "signature", label: "Signature pad" },
  { type: "social", label: "Social profile collector" },
  { type: "page", label: "New page (multi-step)" },
  { type: "rank", label: "Rank in order" },
  { type: "matrix", label: "Skill matrix (rate each row)" },
  { type: "emoji", label: "Emoji reaction scale" },
  { type: "color", label: "Color swatch picker" },
  { type: "tags", label: "Tag cloud (type & add)" },
];

/** Time served since `joined`, in whole years, months, weeks and days (calendar exact). */
export function served(joined: string, now = new Date()) {
  const [y, m, d] = joined.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  if (start > now) return { years: 0, months: 0, weeks: 0, days: 0 };
  let years = now.getFullYear() - y;
  let months = now.getMonth() - (m - 1);
  let days = now.getDate() - d;
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, weeks: Math.floor(days / 7), days: days % 7 };
}

/** Is a required field answered? (null when fine, else the message). */
export function missing(f: Field, v: Answer | undefined): string | null {
  // A ranking always has an order, even if left as it came.
  if (["section", "page", "rank"].includes(f.type)) return null;
  if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(String(v)))
    return "Enter a valid email address.";
  if (f.type === "url" && v && !/^https?:\/\/\S+\.\S+/.test(String(v)))
    return "Enter a full link starting with https://";
  if (f.type === "phone" && v && String(v).replace(/\D/g, "").length < 10)
    return "Enter a full phone number.";
  if (!f.required) return null;
  if (f.type === "terms" && v !== true) return "Please agree to continue.";
  if (f.type === "social" || f.type === "matrix")
    return v && Object.values(v as Record<string, string>).some(Boolean)
      ? null
      : "Fill in at least one.";
  if (v === undefined || v === "" || (Array.isArray(v) && !v.length))
    return "This one's required.";
  return null;
}
