/* A3: 10 admin panel upgrades. Each adds something the ~30 current sections don't do. */
(window.PL = window.PL || {}).a3 = {
  title: "10 big admin panel upgrades",
  intro:
    "The admin panel already controls almost everything (members, plans, prices, menus, colors, games, content, Extras, health, storage). These ten turn it from a control panel into a place that tells you how the business is doing and does work for you. None repeats a current section.",
  items: [
    {
      id: "command", tag: "New: Command Center", title: "Live Command Center",
      what: "One live screen to keep open on storm days: a map of members in the app right now and which page they're on, sign-ups and payments ticking in as they happen, the active severe weather, errors in the last hour and every job's last run. A bell sounds (optional) on a new paid member.",
      pros: ["You see storm-day traffic spike in real time", "Spot a broken page within minutes", "Fun to watch the app grow"],
      cons: ["Presence uses Supabase Realtime (free tier: 200 at once; beyond that it samples)"],
      effort: "Medium", impact: 5,
    },
    {
      id: "funnel", tag: "New: Growth", title: "Growth funnel and retention",
      what: "Where people drop off between visiting, opening a guest page, starting sign-up, choosing a plan and paying. Weekly cohorts (how many of October's sign-ups still use the app), churn with the reasons members give when they cancel, and a 3-month revenue forecast from your real numbers.",
      pros: ["Tells you exactly which step to fix", "Shows if a promo actually worked"],
      cons: ["Needs a small private event log (about 1 MB a month)"],
      effort: "Medium", impact: 5,
    },
    {
      id: "timeline", tag: "Upgrade: Members", title: "Member timeline, tags and segments",
      what: "Open any member and see their whole story on one timeline: joined, plan changes, payments, last seen, pages they use most, badges, messages to the inbox, your notes. Tag members ('beta tester', 'chaser', 'VIP friend') and build saved segments ('paid, inactive 14 days, in Oklahoma') to act on.",
      pros: ["Personal service at scale", "Segments feed campaigns, rollouts and promos"],
      cons: ["Notes are private to admins (and covered by the privacy policy)"],
      effort: "Medium", impact: 4,
    },
    {
      id: "campaigns", tag: "New: Campaigns", title: "Email and push campaigns",
      what: "Write once, send to a segment by email and push: a winter-storm heads-up to the Northeast, a 'we miss you' to inactive members, a promo to free members. Templates in our style, schedule for later, then see opens, clicks and sign-ups each one brought in.",
      pros: ["The cheapest way to win back and upgrade members", "Uses the Resend account we already have"],
      cons: ["Resend's free plan is 3,000 emails a month (100 a day), so big sends are spread over days"],
      effort: "Medium", impact: 5,
    },
    {
      id: "rollouts", tag: "Upgrade: Live ops", title: "Rollouts, beta group and scheduled switches",
      what: "Today a feature switch is on or off for everyone. This adds who sees it (admins only, the beta group, a percentage, a plan, a state) and when (turn on Friday at 6 pm, off on Monday). Perfect for testing new pages with a few members and for timed promos.",
      pros: ["Test new things safely with real members", "Promos and events start and stop on their own"],
      cons: ["One more thing to check when someone says 'I can't see it'"],
      effort: "Small", impact: 4,
    },
    {
      id: "calendar", tag: "New: Calendar", title: "Content calendar",
      what: "Every scheduled thing in one month view: news posts, polls, trivia, Weatherdle words, promos, campaigns, release notes, scheduled switches. Drag to move, tap to edit, and empty days glow so you can see where the app needs something new.",
      pros: ["No more forgetting a poll or a promo end date", "Plan a whole month in one sitting"],
      cons: ["Reads from several sections, so their own pages stay the place for details"],
      effort: "Medium", impact: 3,
    },
    {
      id: "sources", tag: "Upgrade: System health", title: "Data source monitor",
      what: "The app reads from about 30 outside services (SPC, NHC, NWS, MRMS, NOAA's AWS model files, IEM, Mapbox, Stripe, Resend, Gemini…). This checks each one every few minutes and shows uptime, speed and last failure, emails you when one goes down, and puts a calm 'NOAA's feed is slow right now' note on the affected pages.",
      pros: ["You know before members do", "Members see an honest note instead of a blank map"],
      cons: ["A few hundred tiny checks a day (well inside the free plans)"],
      effort: "Medium", impact: 4,
    },
    {
      id: "copilot", tag: "New: Copilot", title: "AI copilot for the admin",
      what: "Ask the panel in plain words: 'how many paid members joined this week in Texas?', 'which page is slowest?'. It also drafts for you: a news post from today's SPC outlook, a reply to a contact message, a campaign email, a poll question. You approve everything; it never sends on its own.",
      pros: ["Saves you hours a week", "Answers questions without digging through tables"],
      cons: ["Read-only access to summary views only, never raw passwords or payment data", "Uses the free Gemini allowance"],
      effort: "Medium", impact: 4,
    },
    {
      id: "experiments", tag: "New: Experiments", title: "A/B tests for sign-up and prices",
      what: "Try two versions of something and let the numbers decide: two headlines on the Join page, two prices for an add-on, two promo offers, two orders of plans. Members are split evenly, and the panel says which one wins and when the result is trustworthy.",
      pros: ["Stops guessing on prices and wording", "Small wins add up to real revenue"],
      cons: ["Needs a few hundred visitors per test to be sure"],
      effort: "Medium", impact: 4,
    },
    {
      id: "social", tag: "New: Social Studio", title: "Social Studio",
      what: "Make a post from any page in two taps: the SPC map, SSWXCon, a storm card, On This Day, with our branded frame and a written caption. Post it to the StormSync Facebook page right away or on a schedule (daily SSWXCon at 8 am), and see which posts bring sign-ups.",
      pros: ["Daily posting with almost no effort", "Every post links back to the app"],
      cons: ["Needs a one-time Facebook page connection (Meta's free Graph API)"],
      effort: "Medium", impact: 5,
    },
  ],
};
