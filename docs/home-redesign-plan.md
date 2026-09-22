# Home page redesign

The home page: masthead, a blue statement band with one `<h1>` and a keyword search, a
two-column body (Updates feed, then a rail of open comment periods and Recent Uploads),
a Browse strip, footer.

## Context

The design handoff sits at `design/handoffs/home/` (local only, not committed; `design`
is in the checkout's local exclude file). The source archive is kept at
`/root/repos/eagle-public-design-handoff-home.zip` and can be unzipped again if the
directory is missing. Same convention as the unified-search handoff.

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

Descoped. The map stays on `/projects`; the home page carries none.

### Browse strip

A centred strip of six links: Map Explorer, All projects, Project notifications, The
assessment process, Legislation, Compliance oversight. It is the only in-app link to
`/legislation`, `/process` and `/compliance-oversight`, so it replaces that role the old
About band held.

## Decisions taken

- Build the backend reads in eagle-demi first, so the page ships in full rather than
  half-empty.
- The feed is called Updates and includes decisions, even though `RecentActivity` has no
  decision type of its own.
- The reader gets a real route, `/updates/:id`, rendered as a dialog.
- The subscribe dialog drops the comment-period checkbox; no ticket asks for it.
- The homepage map is descoped; the map stays on `/projects` only.
- Pinning survives. The backend keeps pinned-first ordering; only the row count became a
  parameter.
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
7. PUBLIC-158 names a homepage map deployment; that deployment is descoped.
8. PUBLIC-152 says each Recent Uploads row links to the project's documents tab; the
   design handoff says the details page. The documents tab shipped.
9. PUBLIC-152 asks that the rail rows be built on the shared display grid component;
   they are not — five 48px rows are not a grid.

## Open items

- Update notification emails link to the project page. They move to `/updates/:id` only
  once this line serves production.
