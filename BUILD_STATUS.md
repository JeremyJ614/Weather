# BUILD_STATUS

**Objective:** StormSync Weather (Weather.SSWX.Space): one mobile-first PWA + Android .apk merging the team's weather apps. Free to run until revenue.

**Stage:** Planning done (Sections A/B, questionnaire, BuildPlan). Building. Phases 01–02 done (02 waits on owner DNS record + service key). Phase 03 done. Current phase: 04 (design system).

**Decisions so far**
- Repo `JeremyJ614/Weather`, working branch `ccr-f5e0b71a-4vr2wk`. No `main` branch yet (repo was empty).
- Lab artifact: https://claude.ai/artifact/MP7RXMdjRqBRKPX6HGUzYH (source `design-lab/section-a/`). Owner answers save to its db doc `picks/selection` (read with ArtifactData get).
- Sources to port: VIP app = `stormsync-dashboard/github-repo/src/pages`; Chase Log = `Log`; Free Content Library = `stormsync-academy`; archive work = `stormsync-archive`.
- Supabase project `weather` (ztzqemzuanwqwqzsaigd). Vercel project `stormsync-weather` (prj_PesfMRifhkpUuLy65BRGtA7YGoO5, team jeremys-projects-3fe6711f), production branch `main`, domain weather.sswx.space added. Vercel MCP lacks create rights; the Vercel CLI/API with the owner's token works. Public env vars set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key).

**Owner decisions (2026-10-13)**
- Menus: users pick from offered lists (main 12, second 8, in `picks/selection`); defaults main=Corner Sweep, second=Morph FAB; same menu can't be both; controls must auto-avoid overlap; admin sets defaults; new-user intro guide ends with menu picking; changeable in account settings.
- Menu fixes: #31 Radial Plates dark with bright outlines + better icons; #15 Speed Dial better icons; #30 Color Morph Bar dark colors, no auto search/keyboard; #11 Flip Tiles scroll hint.
- Themes: same offered-list model, changer in account settings only (not intro). Theme Lab: https://claude.ai/artifact/N2BYy78bktujX3LiUMDwNJ (`design-lab/themes/`, db doc `themes/selection`).
- Hosting: Vercel Hobby until revenue allows Pro. SMS: owner handles separately. iPhone: Home Screen now, App Store later. Android: .apk now, Play later. Engines: repo goes public at launch (free Actions minutes).

- Admin panel = outline's light-blue requests + everything from VIP AdminPanel that fits + owner's 19 picked extras (`picks/selection.admin`) + more of our own. Goal: see and control anything.
- Pricing: owner will supply his own pricing setup before the signup phase.
- Post-launch engines (B2/B3 marked "Post-launch") are built in a private, admin-only preview area for owner approval before going public.
- A2 intro: owner is sending the CodePen zip; rebuild it in the Theme Lab with logo, style and colors.

- See `docs/04-DECISIONS.md` for all owner decisions (supersedes the list above).

**Done:** Section A lab (31 menus, intro, 25 admin extras, 15 themes, 10 pricing), Section B answers (`docs/02-SECTION-B.md`), phase list (`docs/03-PHASES.md`), Section B tabs in the lab.

**Fixed:** lab saved data came back read-only, silently blocking later edits (now cloned on load).

**Blockers:**
- DNS: owner adds CNAME `weather` → `cname.vercel-dns.com` at GoDaddy (GoDaddy connector can't edit DNS).
- `SUPABASE_SERVICE_ROLE_KEY` (secret key) can't be read by the Supabase connector or any token in the creds doc; owner adds it in Vercel env vars before phase 08.

**Next actions**
1. Create `main` from this branch (owner approved), open PR.
2. Phase 04: design system: theme registry (palettes, fonts, templates), type scale, motion rules, base components.

**Lab answers:** questionnaire https://claude.ai/artifact/1S89fRJDQe5QzLj9xEKuQc (db `answers/owner`).

**Resume:** `git -C /home/user/Weather log --oneline -5`; lab test: `node <scratchpad>/test-lab.js design-lab/section-a <outdir>`.

**Commands:** `npm run verify` (typecheck, lint, format, test, build, budget). Dev: `npm run dev`.
