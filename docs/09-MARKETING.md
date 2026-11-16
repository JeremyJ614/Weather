# Free marketing checklist (review round, 2026-10)

What the app now does on its own, and the few one-time steps only the owner can take.

## Built in (nothing to do)
- **Every page** has a title, description, canonical address and a share card (Open Graph and Twitter). Shared links show a picture: the brand card, or the live map or score for SPC & Probability, SSWXCon and On This Day.
- **Structured data** (JSON-LD): Organization, WebSite and WebApplication on every page; FAQPage on the FAQ; DefinedTermSet on the Glossary; Article on library articles; NewsArticle on SSWX News stories.
- **`/sitemap.xml`** lists every page a guest can open (front door, help, library articles, news stories), rebuilt hourly. **`/robots.txt`** points to it and keeps admin and account pages out.
- **`/llms.txt`** describes the site for AI answer engines (ChatGPT, Perplexity, Gemini), built from the menus and the library.
- **`/feed.xml`**: SSWX News as RSS.
- **IndexNow**: publishing a story tells Bing, Yandex and others at once (key file in `public/`).
- **Public front door**: SSWXCon, SPC & Probability, On This Day, the Weather Glossary and the Free Content Library open to guests with a sign-up card, and no intro, tour or gate over them.
- **Share buttons** on stories, library articles and On This Day.
- **App shortcuts**: long-press the installed app for SSWXCon, SPC, Radar and Warnings.

## Added in the Multi App Build Plan (B7, B8, 2026-11-16)
- **Widgets** at `/widgets`: SSWXCon Score, SPC Day 1 Outlook, radar loop and local conditions, each a one-line iframe with a link back.
- **Google Discover**: `max-image-preview:large` on every page; **Google News sitemap** at `/news-sitemap.xml` (listed in robots.txt).
- **IndexNow** every day for the whole sitemap (GitHub Actions `jobs.yml`, job `indexnow`).
- **Web Stories** at `/web-stories`: every Tornado Archive event, and today's outlook on Enhanced-or-higher days.
- **Press kit** at `/press`; **data reports** at `/reports` (The 2026 tornado season in numbers, updated daily).
- **Free journalist requests** (owner): sign up free at Featured, Qwoted and Source of Sources as a severe weather and storm chasing source; point reporters to `/press`.
- **Google News** (owner, optional): add SSWX News in Google's free Publisher Center with the `/feed.xml` feed.

## One-time steps for the owner
1. **Google Search Console** (free): add the property `https://weather.sswx.space`, choose the HTML tag method, copy only the `content` value into Vercel → Settings → Environment Variables as `GOOGLE_SITE_VERIFICATION`, redeploy, then press Verify. Submit `https://weather.sswx.space/sitemap.xml`.
2. **Bing Webmaster Tools** (free, also feeds ChatGPT search and DuckDuckGo): import from Search Console, or set `BING_SITE_VERIFICATION` the same way. Submit the sitemap.
3. **Google Business Profile** (free) for StormSync Media, linking to the site.
4. **Auto-post news**: point a free IFTTT or Zapier applet at `https://weather.sswx.space/feed.xml` to post each new story to Facebook, X, Threads or Discord.
5. **Profiles**: link the site from every StormSync social profile; add those profile URLs to `SITE.sameAs` in `src/lib/seo/site.ts` so search engines tie them together.
6. **Test a share card**: paste a link into https://www.opengraph.xyz or the Facebook Sharing Debugger after deploys.
