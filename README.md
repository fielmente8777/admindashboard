# Eazotel Admin Console

The internal console for Eazotel and Fielmente staff. Staff use it to manage hotel clients:
their profiles, subscriptions and add-on apps, service switches, lead alerts, opening a
client's dashboard, and deleting demo accounts. It also covers the staff team and an
activity log.

It talks **only to gian-new** (`/api/v1/admin/*`). It never calls nexon or gian. The backend
side is documented in `gian-new/src/modules/admin/README.md`, so read that one for routes,
permissions and data rules.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui on
  Base UI, Zustand (session), TanStack Query (server data), react-hook-form + zod.
- **Status (2026-11-06):** everything below is built and was tested against local gian-new
  and the live database. **Not committed and not deployed yet.**

---

## 1. Run it locally

```bash
cp .env.example .env.local     # then fill in the values (section 2)
npm install
npm run dev                    # http://localhost:3000
```

gian-new must be running (`http://localhost:8000` by default) and you need a row in
`admin_users`. Nobody can sign up. Create the first super admin from gian-new:

```bash
# in gian-new
npx tsx scripts/create-admin.ts you@eazotel.com "Your Name"
```

In development the 6-digit login code is printed in gian-new's log when `MAIL_SMTP_HOST`
is empty.

> This is Next.js 16. Read `node_modules/next/dist/docs/` before changing routing or data
> loading (see `AGENTS.md`).

---

## 2. Environment

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_API_URL` | gian-new origin, without `/api/v1` (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google web client id. It must be listed in gian-new's `AUTH_GOOGLE_CLIENT_IDS`, and this site's origin must be an Authorized JavaScript origin on that client |
| `NEXT_PUBLIC_HOTEL_DASHBOARD_URL` | dashboard-new origin (e.g. `http://localhost:5173`). **Open account** sends staff to `<this>/staff-access`. Empty: the button is off |

All three are public (`NEXT_PUBLIC_*` ends up in the browser). Never put a secret here.

---

## 3. What is built

| Screen | Path | Who sees it | What it does |
|---|---|---|---|
| Login | `/login` | everyone | Google sign-in, then a 6-digit code emailed to the staff member. The art is a code-drawn hotel skyline at dusk (`hotel-skyline.tsx`); it is not the client dashboard's illustration |
| Overview | `/` | all staff | greeting, your permissions, your assigned properties, and recent activity (when you can see the audit log) |
| Clients | `/clients` | `clients.view` | search by hotel name, domain, hotel email or ndid. Admins only see clients with a property assigned to them |
| Client page | `/clients/[ndid]` | `clients.view` | profile and properties (edit with `clients.edit`), **Plan payments** (with `billing.view`), **Services** card (chatbot / leads switches, release held leads), **Lead alerts** card (email / WhatsApp per lead source per property), **Subscription** and **Apps** cards, **Open account**, **Delete client** (super admin only) |
| Subscriptions | `/subscriptions` | `subscriptions.view` | count cards that filter by state, sortable columns, paging. Row menu: pause, resume, renew, expire, change plan, match apps to subscription end (`subscriptions.manage`) |
| Billing | `/billing`, `/billing/plans`, `/billing/offers` | `billing.view` (editing: `billing.manage`) | **Overview & payments**: revenue this month, estimated MRR, paying hotels, renewals due, revenue per month (chart + table), hotels per plan, every payment with filters. **Plans & pricing**: plan cards and editor (price, included apps, limits, bullet points, public / custom / private for one hotel, archive), add-on app prices, billing cycles with discounts, GST, seat price, trial days. **Offers**: discount codes with rules and usage |
| Team | `/team` | super admins (`team.manage`) | add staff, change role, status, advanced permissions and assigned properties (property picker searches clients) |
| Activity | `/activity` | super admins (`audit.view`) | the audit log: logins (including refused ones), team changes, client edits, switches, subscription changes, account openings, deletions |

The sidebar hides links the signed-in person has no permission for. The API checks again on
every call, so hiding is only for convenience.

### Opening a client's account

**Open account** (needs `clients.open_account`) asks gian-new for a one-hour hotel token,
then opens `<NEXT_PUBLIC_HOTEL_DASHBOARD_URL>/staff-access#token=…&ndid=…&hid=…` in a new tab.
dashboard-new's `staffAccessLoader` stores the token, clears the address bar and opens the
dashboard. The token travels after `#`, which the browser never sends to a server. Every
opening is in the activity log.

### Deleting a client

Super admins only. The card first shows how many records each collection holds for the
client, then asks for the hotel name to confirm. gian-new copies every record into
`deleted_client_records` before deleting it, so a deletion can be undone by hand (there is no
restore button yet).

---

## 4. How it works

### Sign-in and session

- `stores/auth-store.ts` (Zustand) holds the signed-in staff member and the **access token,
  in memory only**. The refresh token is gian-new's httpOnly `ez_admin_rt` cookie.
- A page reload calls `POST /admin/auth/refresh` to get a new access token.
- `lib/api/api-client.ts` (`ApiClient`) unwraps gian-new's `{ success, data | error }`
  envelope into data or an `ApiError` with a stable `code`. When a call fails with an
  expired token it refreshes once and repeats the call. When access is revoked it signs the
  person out.
- `components/auth/auth-guard.tsx` sends signed-out visitors to `/login`. It runs in the
  browser because the cookie belongs to the API's origin, so the Next.js server can't see it.

### Project layout

```text
app/
  login/page.tsx                 login screen
  (admin)/layout.tsx             AuthGuard + AdminShell (sidebar) + QueryProvider
  (admin)/page.tsx               overview
  (admin)/clients/…, subscriptions/, team/, activity/
components/
  auth/                          login form, Google button, OTP form, skyline, AuthGuard
  layout/                        admin-shell (sidebar), page-states (loading / error / empty), query-provider
  clients/                       clients list, client page and its cards
  subscriptions/                 subscriptions page, subscription + apps cards, row actions
  team/                          team page, member dialog, property picker
  activity/                      audit log page
  overview/                      overview page
  ui/                            shadcn components (base-nova style)
lib/
  api/                           ApiClient + one class per area: auth, clients, subscriptions, team, audit
  activity-text.ts               audit actions → readable sentences
  env.ts, format.ts, utils.ts
stores/auth-store.ts             session (Zustand)
```

### Rules for new pages

- A page behind `AuthGuard` is a **server** `page.tsx` with `export const instant = false`
  that renders a client component. Otherwise Next's dev validator reports a dropped segment
  (putting the setting on the layout does not help).
- Add an API call as a method on the matching class in `lib/api/`, never as a raw `fetch` in a
  component.
- Switch on `ApiError.code`, never on the message.
- Don't reuse the client dashboard's visuals here, and avoid template-looking layouts.

---

## 5. Not built yet

- Credits (Eazotel and OpenAI credits, clients buying tokens, staff sharing credits).
- Refunds and GST invoice PDFs from the Billing screens.
- More client services than chatbot and leads.
- The hotel email-change flow (the owner login email can't be edited here on purpose).
- A restore button for deleted clients.
- A chat agent for the marketing team.
- Deployment (hosting, domain, Google origin for the production URL).
