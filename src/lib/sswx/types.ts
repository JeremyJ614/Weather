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
export type RosterStyle = "holo" | "orbit" | "ribbon";
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
  | "section";
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
};
export type Application = {
  id: string;
  title: string;
  blurb: string;
  accent: string;
  open: boolean;
  fields: Field[];
};
export type Status = { id: string; label: string; color: string };
export type Social = {
  id: string;
  name: string;
  color: string;
  prefix: string;
};
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
};

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
  style: "holo",
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
    { id: "received", label: "Received", color: "#94a3b8" },
    { id: "processing", label: "Processing", color: "#38bdf8" },
    { id: "interview", label: "Interview", color: "#a78bfa" },
    { id: "modify", label: "Requires Modification", color: "#f59e0b" },
    { id: "waitlist", label: "Waitlisted", color: "#f472b6" },
    { id: "accepted", label: "Accepted", color: "#22c55e" },
    { id: "rejected", label: "Rejected", color: "#ef4444" },
  ],
  team: [{ id: "jay", name: "Jay Myers" }],
  socials: [
    { id: "x", name: "X", color: "#e7e9ea", prefix: "https://x.com/" },
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

/** Upgrade ideas for the Application Center (owner picks in admin → SSWX → Ideas). */
export const IDEAS: { id: string; title: string; text: string }[] = [
  [
    "autosave",
    "Draft autosave",
    "Answers save on the device as they type, so a closed tab never loses an application.",
  ],
  [
    "steps",
    "Multi-step pages",
    "Long applications split into pages with a glowing progress rail and back/next.",
  ],
  [
    "logic",
    "Conditional questions",
    "Show a question only when an earlier answer matches (e.g. 'Yes' reveals 'Explain').",
  ],
  [
    "upload",
    "File & photo uploads",
    "Résumé, chase photos or a portfolio PDF attached to the application.",
  ],
  [
    "deadline",
    "Open/close dates",
    "Applications open and close on their own at set dates, with a countdown.",
  ],
  [
    "limit",
    "Seat limits",
    "Close an application after a set number of submissions.",
  ],
  [
    "scoring",
    "Reviewer scorecards",
    "Score each answer 1–5 in the inbox; totals rank applicants.",
  ],
  [
    "notes",
    "Private review notes",
    "Threaded staff notes on each submission, never shown to the applicant.",
  ],
  [
    "message",
    "Message the applicant",
    "Send a note with a status change ('Requires Modification: add your city').",
  ],
  [
    "resubmit",
    "Edit & resubmit",
    "An application marked Requires Modification reopens for the applicant to fix.",
  ],
  [
    "timeline",
    "Status timeline",
    "Applicants see every status change with its date, like a package tracker.",
  ],
  [
    "push",
    "Push alerts",
    "A phone notification when an application's status changes.",
  ],
  [
    "interview",
    "Interview booking",
    "Accepted-to-interview applicants pick a time from slots you set.",
  ],
  [
    "templates",
    "Application templates",
    "Start a new application from a saved one; duplicate in one tap.",
  ],
  [
    "export",
    "CSV export",
    "Download every submission of an application as a spreadsheet.",
  ],
  [
    "quiz",
    "Knowledge check",
    "Graded weather questions with an automatic score on submit.",
  ],
  [
    "captcha",
    "Bot shield",
    "The site's proof-of-work check on submit, so spam never reaches the inbox.",
  ],
  [
    "analytics",
    "Funnel stats",
    "Views, starts, completions and drop-off question per application.",
  ],
  [
    "reminders",
    "Unfinished reminders",
    "A gentle reminder when a draft sits unfinished for three days.",
  ],
  [
    "badges",
    "Acceptance badges",
    "Accepting an applicant awards a profile badge and adds them to the roster draft.",
  ],
  [
    "eligibility",
    "Eligibility gate",
    "Questions up front (age, state) that stop an application early if not met.",
  ],
  [
    "anonymous",
    "Anonymous feedback forms",
    "Applications that hide the sender's name from reviewers.",
  ],
].map(([id, title, text]) => ({ id, title, text }));

/** Is a required field answered? (null when fine, else the message). */
export function missing(f: Field, v: Answer | undefined): string | null {
  if (f.type === "section") return null;
  if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(String(v)))
    return "Enter a valid email address.";
  if (f.type === "url" && v && !/^https?:\/\/\S+\.\S+/.test(String(v)))
    return "Enter a full link starting with https://";
  if (f.type === "phone" && v && String(v).replace(/\D/g, "").length < 10)
    return "Enter a full phone number.";
  if (!f.required) return null;
  if (f.type === "terms" && v !== true) return "Please agree to continue.";
  if (f.type === "social")
    return v && Object.values(v as Record<string, string>).some(Boolean)
      ? null
      : "Add at least one profile.";
  if (v === undefined || v === "" || (Array.isArray(v) && !v.length))
    return "This one's required.";
  return null;
}
