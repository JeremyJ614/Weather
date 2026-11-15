"use server";

import { getRealViewer } from "@/lib/auth/viewer";
import {
  activePromos,
  couponOff,
  DAY_PASS,
  perkOn,
  quote,
  RESPONDER_PCT,
  TRIAL_DAYS,
  type Choice,
  type TierId,
} from "@/lib/billing/plans";
import {
  getPass,
  getResponders,
  getTrials,
  isResponder,
  savePass,
  saveResponders,
} from "@/lib/billing/perks";
import {
  SELLABLE_SLUGS,
  getBilling,
  getClaims,
  today,
} from "@/lib/billing/server";
import {
  checkoutUrl,
  dayPassCheckoutUrl,
  portalUrl,
  stripeOn,
} from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type PlanResult =
  | { error: string }
  | { status: "checkout"; url: string }
  | {
      status: "free" | "awaiting_payment";
      first: number;
      regular: number;
      promo: string | null;
    };

const TIERS = new Set(["free", "basic", "chasers", "advanced", "vip"]);

/** Checks a code for the plan being built (never reveals other codes). */
export async function checkCoupon(code: string, tier: string) {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(c)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("coupon_check", { p_code: c, p_tier: tier });
  const row = (data as { kind: string; amount: number }[] | null)?.[0];
  return row ? { code: c, kind: row.kind, amount: row.amount } : null;
}

/**
 * Saves the signed-in member's plan. Priced here, on the server, from the owner's
 * pricing, today's promotions and a checked coupon; the browser's numbers are ignored.
 * With card payments connected a paid plan goes straight to Stripe Checkout; without them
 * it is saved as awaiting payment and nothing is charged.
 */
export async function savePlan(
  raw: Choice,
  coupon: string,
): Promise<PlanResult> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  if (!viewer.name) return { error: "Finish your profile first." };
  const sellable = SELLABLE_SLUGS;
  const pick = (x: unknown) =>
    Array.isArray(x)
      ? [
          ...new Set(
            x.filter(
              (s): s is string => typeof s === "string" && sellable.includes(s),
            ),
          ),
        ].slice(0, 80)
      : [];
  if (
    !raw ||
    !TIERS.has(raw.tier) ||
    (raw.cycle !== "month" && raw.cycle !== "year")
  )
    return { error: "Pick a plan." };
  const choice: Choice = {
    tier: raw.tier,
    cycle: raw.cycle,
    pages: [],
    addons: pick(raw.addons),
  };
  const db = supabaseAdmin();
  const { data: had } = await db
    .from("subscriptions")
    .select("status, stripe_customer, stripe_subscription")
    .eq("user_id", viewer.id)
    .maybeSingle();
  // A second checkout would start a second subscription; changes go through billing.
  if (had?.status === "active" && had.stripe_subscription)
    return {
      error:
        "You already have a paid plan. Use Manage billing to change or cancel it first.",
    };
  const [billing, claims] = await Promise.all([getBilling(), getClaims()]);
  const q = quote(
    billing,
    choice,
    sellable,
    activePromos(billing, claims, today(), choice),
  );
  const c =
    coupon && q.regular > 0 ? await checkCoupon(coupon, choice.tier) : null;
  if (coupon && q.regular > 0 && !c)
    return { error: "That code isn't valid for this plan." };
  const first = [couponOff(q.first[0], c), ...q.first.slice(1)];
  // A recent Storm Day Pass is taken off the first payment, once (post-launch A4).
  const pass =
    q.regular > 0 ? await getPass(viewer.id).catch(() => null) : null;
  const credit =
    pass && !pass.used && Date.now() - pass.until < 7 * 864e5 ? pass.credit : 0;
  if (credit) first[0] = Math.max(0, first[0] - credit);
  const responder =
    perkOn(billing, "responder", today()) &&
    (await isResponder(viewer.id).catch(() => false));
  const { error } = await db.rpc("save_plan", {
    p_user: viewer.id,
    p_tier: choice.tier as TierId,
    p_cycle: choice.cycle,
    p_pages: choice.pages,
    p_addons: choice.addons,
    p_regular: q.regular,
    p_first: first,
    p_promo: q.promo?.id ?? null,
    p_coupon: c?.code ?? null,
  });
  if (error) return { error: "Your plan couldn't be saved. Try again." };
  if (q.regular > 0 && stripeOn()) {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    try {
      const url = await checkoutUrl({
        user: viewer.id,
        email: user?.email,
        customer: had?.stripe_customer,
        name: `${billing.tiers.find((t) => t.id === choice.tier)?.name ?? "Plan"}${choice.addons.length ? ` + ${choice.addons.length} add-on${choice.addons.length === 1 ? "" : "s"}` : ""}`,
        cycle: choice.cycle,
        regular: q.regular,
        first,
        origin: await origin(),
        forever: responder ? RESPONDER_PCT : undefined,
      });
      if (credit && pass) await savePass(viewer.id, { ...pass, used: true });
      return { status: "checkout", url };
    } catch {
      return {
        error:
          "Your plan is saved, but card checkout couldn't start. Try again in a moment.",
      };
    }
  }
  return {
    status: q.regular === 0 ? "free" : "awaiting_payment",
    first: first[0],
    regular: q.regular,
    promo: q.promo?.name ?? null,
  };
}

async function origin() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "weather.sswx.space";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/** Opens Stripe's billing portal for the signed-in member's paid plan. */
export async function manageBilling(): Promise<{
  url?: string;
  error?: string;
}> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  if (!stripeOn()) return { error: "Card payments aren't connected yet." };
  const { data } = await (
    await supabaseServer()
  )
    .from("subscriptions")
    .select("stripe_customer")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!data?.stripe_customer)
    return { error: "There's no paid plan on this account yet." };
  try {
    return { url: await portalUrl(data.stripe_customer, await origin()) };
  } catch {
    return { error: "Billing couldn't open. Try again in a moment." };
  }
}

async function email() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.email ?? null;
}

/**
 * Post-launch A4: the 7-day VIP trial. Card required, charged only if not canceled before
 * the trial ends; once per member (anyone who has had a paid plan or a trial is refused).
 */
export async function startTrial(): Promise<PlanResult> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  if (!viewer.name) return { error: "Finish your profile first." };
  const billing = await getBilling();
  if (!perkOn(billing, "trial", today()))
    return { error: "The free trial isn't running right now." };
  if (!stripeOn()) return { error: "Card payments aren't connected yet." };
  const db = supabaseAdmin();
  const { data: had } = await db
    .from("subscriptions")
    .select("stripe_customer, stripe_subscription")
    .eq("user_id", viewer.id)
    .maybeSingle();
  const trials = await getTrials();
  if (had?.stripe_subscription || trials.ids.includes(viewer.id))
    return {
      error: "The free trial is for members who haven't had a paid plan yet.",
    };
  const vip = billing.tiers.find((t) => t.id === "vip");
  if (!vip?.month) return { error: "VIP isn't for sale right now." };
  const { error } = await db.rpc("save_plan", {
    p_user: viewer.id,
    p_tier: "vip",
    p_cycle: "month",
    p_pages: [],
    p_addons: [],
    p_regular: vip.month,
    p_first: [vip.month],
    p_promo: "trial",
    p_coupon: null,
  });
  if (error) return { error: "The trial couldn't start. Try again." };
  try {
    const url = await checkoutUrl({
      user: viewer.id,
      email: await email(),
      customer: had?.stripe_customer,
      name: `${vip.name} (${TRIAL_DAYS}-day free trial)`,
      cycle: "month",
      regular: vip.month,
      first: [vip.month],
      origin: await origin(),
      trialDays: TRIAL_DAYS,
    });
    return { status: "checkout", url };
  } catch {
    return { error: "Card checkout couldn't start. Try again in a moment." };
  }
}

/** Post-launch A4: the Storm Day Pass, one payment for 24 hours of everything. */
export async function buyDayPass(): Promise<PlanResult> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  const billing = await getBilling();
  if (!perkOn(billing, "daypass", today()))
    return { error: "The Storm Day Pass isn't on sale right now." };
  if (!stripeOn()) return { error: "Card payments aren't connected yet." };
  const pass = await getPass(viewer.id).catch(() => null);
  if (pass && pass.until > Date.now())
    return { error: "Your Storm Day Pass is still running." };
  try {
    const url = await dayPassCheckoutUrl({
      user: viewer.id,
      email: await email(),
      cents: DAY_PASS.cents,
      hours: DAY_PASS.hours,
      origin: await origin(),
    });
    return { status: "checkout", url };
  } catch {
    return { error: "Card checkout couldn't start. Try again in a moment." };
  }
}

const ROLES = [
  "SKYWARN spotter",
  "Firefighter",
  "EMS",
  "Police",
  "Emergency manager",
  "Other first responder",
];

/**
 * Post-launch A4: a spotter or first responder asks for the discount with a photo of their
 * card or ID. The photo goes to private storage; admin approves it in Pricing → Promotions,
 * and the Contact inbox gets a note so it's seen.
 */
export async function askResponder(
  _: { ok?: string; error?: string },
  fd: FormData,
): Promise<{ ok?: string; error?: string }> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  const billing = await getBilling();
  if (!perkOn(billing, "responder", today()))
    return { error: "This discount isn't open right now." };
  const role = String(fd.get("role") ?? "");
  const agency = String(fd.get("agency") ?? "")
    .trim()
    .slice(0, 120);
  const photo = fd.get("photo");
  if (!ROLES.includes(role)) return { error: "Pick your role." };
  if (agency.length < 2)
    return { error: "Add your agency, department or spotter ID." };
  if (!(photo instanceof File) || photo.size === 0)
    return { error: "Add a photo of your ID or spotter card." };
  if (photo.size > 6_000_000) return { error: "The photo must be under 6 MB." };
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type))
    return { error: "The photo must be a JPG, PNG, WebP or HEIC image." };
  const r = await getResponders();
  const mine = r.list.find((x) => x.user === viewer.id);
  if (mine?.status === "approved") return { ok: "You're already approved." };
  if (mine?.status === "pending")
    return { ok: "Your request is in. We'll let you know soon." };
  const db = supabaseAdmin();
  const path = `perks/responders/${viewer.id}-${Date.now()}.${photo.type.split("/")[1]}`;
  await db.storage.createBucket("ops", { public: false }).catch(() => null);
  const up = await db.storage
    .from("ops")
    .upload(path, photo, { contentType: photo.type, upsert: true });
  if (up.error) return { error: "The photo couldn't be uploaded. Try again." };
  const mail = (await email()) ?? "";
  await saveResponders([
    ...r.list.filter((x) => x.user !== viewer.id),
    {
      user: viewer.id,
      name: viewer.name ?? "Member",
      email: mail,
      role,
      agency,
      photo: path,
      at: new Date().toISOString(),
      status: "pending",
    },
  ]);
  await db.from("contact_messages").insert({
    form: "responder",
    user_id: viewer.id,
    name: (viewer.name ?? "Member").slice(0, 80),
    email: mail.slice(0, 200) || "unknown@weather.sswx.space",
    subject: "Spotter / first responder discount request",
    body: `${role} · ${agency}\nReview the photo and approve it in admin → Pricing → Promotions.`,
  });
  return { ok: "Thanks! Your request is in. We'll let you know soon." };
}
