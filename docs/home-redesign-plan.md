# Home page redesign

The home page: header, a blue masthead with one `<h1>` and a keyword search; a slim Map
Explorer band directly under the masthead; a two-column body (Updates feed, then a rail
of open comment periods and Recent Uploads); an About section; footer. The Browse strip
is gone; the home page's About band and the About page's rail carry the links it used
to hold.

## Context

The design handoff sits at `design/handoffs/home-v4/` (local only, not committed;
`design` is in the checkout's local exclude file). The original archive it came from
was not kept. v4 supersedes v3: v3 had a map screenshot and a masthead
purpose line, both dropped in v4. The v2 handoff and its
`/root/repos/eagle-public-design-handoff-home.zip` archive stay as the record of what
v2 shipped.

Five tickets name pieces of this work: PUBLIC-154 (homepage search), PUBLIC-152 (Recent
Uploads), PUBLIC-160 (Updates display), PUBLIC-142 (email subscription), PUBLIC-136
(site look and feel). No single ticket owns the home page as a composition.

## What was built

### Statement band and search

One `<h1>`, one keyword field. Submit sends the keyword and a record type to `/search`
through `searchUrl()`; results never render on the home page itself.

### Updates feed

Reads a merged feed, `dataset=HomeFeed&pageSize=5`: pinned rows first, then the newest
updates and decisions, newest first. Each card is three lines: kind, project, headline.
A News-type row reads as "Update"; a project decision reads as "Decision". An Update
card opens the reader; a Decision card links straight to its project, since there is no
update text to read.

Backend pinning is unchanged from production; only the row count became a caller-set
limit (five, up from the old four-row `top=true`).

### The reader, `/updates/:id`

A route entry renders the same `Home` component; a non-empty `:id` opens the reader as a
dialog over the page. The body is the update's TinyMCE HTML, sanitized the same way the
project Updates tab already does. A Documents section shows the update's one
`documentUrl` as a single link — an update carries no document name, type or date, so
the accordion cannot show more than that. Closing the reader navigates back to `/`, so
browser Back closes it too.

A cold load reads `dataset=RecentActivity&and[_id]=<id>`. A reader opened from a feed
card reuses the row already in memory instead of asking again.

Update notification emails still link to the project page, not `/updates/:id`. That
changes once this line serves production.

### Open for comment

Reads `dataset=CommentPeriod&and[status]=open` across every project, soonest to close
first. Every period in the rail is an ENGAGE engagement, so a card links out through
`EngagementLink` when the period carries `isMet` and a `metURL`; the internal
`/p/:id/cp/:id/details` route is the fallback. The empty state names how many periods
closed in the last 30 days when that count is available.

The foot link, "Upcoming and recently closed periods," goes to
`/search?record=commentPeriods`, the Comment periods tab on `/search`.

### Recent Uploads

Reads `/documents/recent-uploads?limit=5`, unchanged from what already shipped as
`v3.0.0-beta.36`. Each row is a single 48px link: project name, a tab label derived from
the newest upload's document type, and the date. The row links to the project's
documents tab (`/p/:id/documents?sortBy=-datePosted`), per PUBLIC-152, not to the
project's details page as the design handoff shows.

### Subscribe dialog

The Updates heading carries a "Subscribe to updates" button that opens a dialog: an
email field, the FOIPPA collection notice, Cancel and Subscribe. There are no scope
checkboxes. This is the "All Updates" path from PUBLIC-142 — subscribing to
`eao:updates` makes eagle-notify add the broader EAO announcements automatically, so
there is nothing left to choose. No ticket asks for a comment-period subscription, so
that checkbox from the design handoff was dropped rather than built.

### Homepage map

A slim Map Explorer band sits directly under the masthead: an `<h2>`, body copy naming
the map's real filters (project type, region, project phase), and an "Open Map
Explorer" button. There is no preview image. The button links to `/projects`, the Map
Explorer route. The live interactive map is not embedded on the home page; it is heavy
to load and would trap scroll and keyboard focus inside a home-page band. Because the
band carries no image, the masthead above it stays the same height as `/search` and
the project page.

### About section

An About section sits after the Updates/rail body and before the footer, in two
columns. The left column has an `<h2>` About, the About page's summary paragraph, and
a link, "About environmental assessment," to `/about`. The right column is three link
rows, the same pattern as Recent Uploads: Which Act applies (`/about#process`),
Legislation (`/about#legislation`), and Compliance oversight (`/about#compliance`).
The two shortened row descriptions still need content-owner sign-off; tracked in
`TODO.md`.

### Browse strip

Superseded 2026-09-28 by the About page: the header's About link and the home page's
About band now carry the way to Legislation, The assessment process and Compliance
oversight.

A centred strip of six links: Map Explorer, All projects, Project notifications, The
assessment process, Legislation, Compliance oversight. Superseded as above; the home
page's About band and the header's About link carry the `/legislation`, `/process`
and `/compliance-oversight` links now too.

## Decisions taken

- Build the backend reads in eagle-demi first, so the page ships in full rather than
  half-empty.
- The feed is called Updates and includes decisions, even though `RecentActivity` has no
  decision type of its own.
- The reader gets a real route, `/updates/:id`, rendered as a dialog.
- The subscribe dialog drops the comment-period checkbox; no ticket asks for it.
- The homepage map is a slim text-and-button band, not a live embed and not a preview
  image. The button links to `/projects`; the interactive map itself stays on
  `/projects` only.
- Pinning survives. The backend keeps pinned-first ordering; only the row count became a
  parameter.
- The Map Explorer band and the About band both use a light gray background; the page
  body itself stays white. The v4 handoff showed the About band white.
- The Map Explorer band's copy says "project phase," matching the map's real filter
  name, not "assessment phase" as the v4 handoff draft had it.
- Nine ticket-reconciliation items are tracked, not filed as Jira tickets yet (see
  below).

## Take back to design and Jira

Tracked here, not yet filed:

1. PUBLIC-154 specifies results rendering on the home page; the shipped page never
   answers there. Needs recording on the ticket.
2. No ticket owns the home page as a composition. The feed and comment-period rail trace
   to PUBLIC-31 and PUBLIC-32, both closed as duplicates.
3. PUBLIC-160 covers the Updates tab, the project updates panel and the subscription
   email, not the homepage feed.
4. PUBLIC-32 asked for Upcoming, Open and Recently Closed groups in the rail; the
   shipped rail shows open periods only.
5. The subscribe dialog's comment-period checkbox has no ticket behind it and was
   dropped.
6. PUBLIC-31 asked for expand-in-place cards with Project Info / View Document(s) / View
   Engagement buttons, not a reader dialog.
7. PUBLIC-158 names a homepage map deployment. The home page now carries a Map
   Explorer band that links to `/projects`, not a live map; check whether that satisfies
   the ticket or whether it stays open. Not yet confirmed as the ticket to close.
8. PUBLIC-152 says each Recent Uploads row links to the project's documents tab; the
   design handoff says the details page. The documents tab shipped.
9. PUBLIC-152 asks that the rail rows be built on the shared display grid component;
   they are not — five 48px rows are not a grid.

## Open items

- Update notification emails link to the project page. They move to `/updates/:id` only
  once this line serves production.
