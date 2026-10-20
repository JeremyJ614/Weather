/**
 * Disaster Response (Phase 61): the organization directory and the volunteer roster.
 * Organizations and volunteers sign up on /disaster-response; each sign-up lands in admin →
 * Contact inbox and shows (organizations) or joins the roster (volunteers) once approved.
 */
export type Status = "pending" | "approved" | "declined";

export const SOCIALS = [
  { id: "facebook", label: "Facebook", host: "facebook.com" },
  { id: "instagram", label: "Instagram", host: "instagram.com" },
  { id: "x", label: "X", host: "x.com" },
  { id: "youtube", label: "YouTube", host: "youtube.com" },
  { id: "tiktok", label: "TikTok", host: "tiktok.com" },
] as const;
export type SocialId = (typeof SOCIALS)[number]["id"];

export type Org = {
  id: string;
  status: Status;
  name: string;
  mission: string;
  services: string[];
  areas: string;
  website: string | null;
  donate_url: string | null;
  volunteer_url: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  socials: Partial<Record<SocialId, string>>;
  sort: number;
};
export const ORG_COLUMNS =
  "id, status, name, mission, services, areas, website, donate_url, volunteer_url, phone, email, logo_url, socials, sort";

export type Volunteer = {
  id: string;
  status: Status;
  name: string;
  email: string;
  phone: string | null;
  base: string;
  travel: string;
  availability: string;
  skills: string[];
  org_id: string | null;
  note: string | null;
  created_at: string;
};

export const SERVICES = [
  "Shelter",
  "Food & water",
  "Supplies",
  "Debris removal",
  "Chainsaw work",
  "Roof tarping",
  "Muck-out",
  "Rebuilding",
  "Damage assessment",
  "Medical care",
  "Mental & spiritual care",
  "Financial help",
  "Reconnecting families",
  "Animal rescue",
  "Transportation",
  "Donations drop-off",
];
export const SKILLS = [
  "Debris cleanup",
  "Chainsaw (experienced)",
  "Roof tarping",
  "Construction or trades",
  "Heavy equipment",
  "Shelter support",
  "Cooking or food service",
  "Medical (licensed)",
  "Mental health (licensed)",
  "Ham radio or communications",
  "Driving (own vehicle)",
  "Childcare",
  "Animal care",
  "Translation",
  "Phones, office or data entry",
];
export const AVAILABILITY = [
  "On call: within 24 hours",
  "Within a few days",
  "Weekends",
  "Remote only",
];
export const TRAVEL = [
  "My town",
  "Within 50 miles",
  "Within my state",
  "Anywhere",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\-.\s\d]{7,20}$/;
const one = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

/** A web address, with https:// added when it is left off; null when it isn't one. */
export function cleanUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    const s = u.toString();
    return s.length <= 300 ? s : null;
  } catch {
    return null;
  }
}

export type OrgInput = Omit<Org, "id" | "status" | "sort">;
type Got = (id: string) => string;
type GotAll = (id: string) => string[];

/** Checks an organization's sign-up (or an admin's edit); every message names the field. */
export function checkOrg(get: Got, all: GotAll): OrgInput | { error: string } {
  const name = one(get("name"), 100);
  if (name.length < 2) return { error: "Fill in the organization's name." };
  const mission = get("mission").trim().slice(0, 600);
  if (mission.length < 10)
    return { error: "Tell people what your organization does." };
  const areas = one(get("areas"), 200);
  if (areas.length < 2) return { error: "Fill in the areas you serve." };
  const services = [...new Set(all("services"))].filter((x) =>
    SERVICES.includes(x),
  );
  if (!services.length) return { error: "Pick at least one thing you do." };
  const links: Record<string, string | null> = {};
  for (const [k, label] of [
    ["website", "Website"],
    ["donate_url", "Donation link"],
    ["volunteer_url", "Volunteer link"],
  ] as const) {
    const raw = get(k);
    links[k] = cleanUrl(raw);
    if (raw.trim() && !links[k])
      return { error: `“${label}” needs a web address.` };
  }
  if (!links.website) return { error: "Fill in your website." };
  const logoRaw = get("logo_url");
  const logo = cleanUrl(logoRaw);
  if (logoRaw.trim() && !logo?.startsWith("https://"))
    return { error: "“Logo” needs an https:// image address." };
  const phone = one(get("phone"), 30);
  if (phone && !PHONE.test(phone))
    return { error: "“Public phone” needs a phone number." };
  const email = one(get("public_email"), 200);
  if (email && !EMAIL.test(email))
    return { error: "“Public email” needs a real email address." };
  const socials: Org["socials"] = {};
  for (const s of SOCIALS) {
    const raw = get(`social_${s.id}`);
    if (!raw.trim()) continue;
    const u = cleanUrl(raw);
    const host = u ? new URL(u).hostname.replace(/^www\.|^m\./, "") : "";
    const ok = host === s.host || (s.id === "x" && host === "twitter.com");
    if (!u || !ok)
      return { error: `“${s.label}” needs a link to your ${s.label} page.` };
    socials[s.id] = u;
  }
  return {
    name,
    mission,
    services,
    areas,
    website: links.website,
    donate_url: links.donate_url,
    volunteer_url: links.volunteer_url,
    phone: phone || null,
    email: email || null,
    logo_url: logo,
    socials,
  };
}

export type VolunteerInput = Omit<
  Volunteer,
  "id" | "status" | "created_at" | "name" | "email"
>;

/** Checks a volunteer's sign-up against the lists above. */
export function checkVolunteer(
  get: Got,
  all: GotAll,
): VolunteerInput | { error: string } {
  const base = one(get("base"), 120);
  if (base.length < 2) return { error: "Fill in where you're based." };
  const travel = get("travel");
  if (!TRAVEL.includes(travel))
    return { error: "Pick how far you can travel." };
  const availability = get("availability");
  if (!AVAILABILITY.includes(availability))
    return { error: "Pick when you can help." };
  const skills = [...new Set(all("skills"))].filter((x) => SKILLS.includes(x));
  if (!skills.length) return { error: "Pick at least one way you can help." };
  const phone = one(get("phone"), 30);
  if (phone && !PHONE.test(phone))
    return { error: "“Phone” needs a phone number." };
  const org = get("org_id");
  return {
    base,
    travel,
    availability,
    skills,
    phone: phone || null,
    org_id: /^[0-9a-f-]{36}$/.test(org) ? org : null,
    note: get("note").trim().slice(0, 1000) || null,
  };
}

/** The applicant's name and email, which every sign-up needs to be answered. */
export function checkContact(
  get: Got,
): { name: string; email: string } | { error: string } {
  const name = one(get("contact_name"), 80);
  if (!name) return { error: "Fill in your name." };
  const email = one(get("contact_email"), 200).toLowerCase();
  if (!EMAIL.test(email)) return { error: "Your email needs to be real." };
  return { name, email };
}

/** The inbox message for an organization's sign-up. */
export function orgMessage(o: OrgInput): { subject: string; body: string } {
  const social = Object.entries(o.socials).map(([k, v]) => `${k}: ${v}`);
  return {
    subject: `Organization sign-up: ${o.name}`.slice(0, 120),
    body: [
      `Organization: ${o.name}`,
      `Areas served: ${o.areas}`,
      `Does: ${o.services.join(", ")}`,
      `Website: ${o.website}`,
      o.donate_url && `Donate: ${o.donate_url}`,
      o.volunteer_url && `Volunteer: ${o.volunteer_url}`,
      o.phone && `Public phone: ${o.phone}`,
      o.email && `Public email: ${o.email}`,
      o.logo_url && `Logo: ${o.logo_url}`,
      ...social,
      "",
      o.mission,
      "",
      "Approve or decline it below; nothing is listed until it is approved.",
    ]
      .filter((x) => x !== null)
      .join("\n")
      .slice(0, 4000),
  };
}

/** The inbox message for a volunteer's sign-up. */
export function volunteerMessage(
  name: string,
  v: VolunteerInput,
  org: string | null,
): { subject: string; body: string } {
  return {
    subject: `Volunteer sign-up: ${name}`.slice(0, 120),
    body: [
      `Based in: ${v.base} (travels: ${v.travel.toLowerCase()})`,
      `Available: ${v.availability}`,
      `Can help with: ${v.skills.join(", ")}`,
      v.phone && `Phone: ${v.phone}`,
      `Wants to help: ${org ?? "wherever needed"}`,
      ...(v.note ? ["", v.note] : []),
      "",
      "Approve to add them to the volunteer roster (admin → Disaster Response).",
    ]
      .filter((x) => x !== null)
      .join("\n")
      .slice(0, 4000),
  };
}
