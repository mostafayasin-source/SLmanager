# SLmanager

SLmanager is an interactive demo of a subscription platform for barbershop staff, weekly schedules, and attendance. The interface is in Swedish. It runs entirely in the browser.

## Setup

```bash
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173/SLmanager/` because the production base path is `/SLmanager/`. Other commands:

```bash
npm test
npm run build
npm run preview
```

## Demo login

The start page is labeled **Demoläge — inga riktiga konton**. There are two entries:

- **Prova som plattformsägare** opens the platform dashboard for every salon.
- **Prova som salongsägare** opens Klipp & Skägg Vasastan only.

The choice is stored in this browser. Use **Logga ut** to switch roles. Route guards only keep the demo navigation honest. They are not authentication.

**Återställ demodata** replaces the saved demo with fresh sample dates for the current week. Confirm before it runs.

## What the demo includes

- Three fictional salons with different subscription states: active, expiring within 14 days, and suspended.
- Employees, planned shifts, and attendance for the active salon, generated around the current week in Europe/Stockholm.
- Manual subscription actions: activate, suspend, and renew. Prices are a calculated monthly total, not collected revenue.
- Separate planned shifts and attendance. Durations come from timestamps, including shifts that cross midnight. Open sessions stay incomplete.
- Attendance corrections store the original values, the new values, the time, a required reason, and the demo user.
- When a subscription is expired or suspended, schedule and attendance changes are locked. Reports and customer support stay available.
- Customer support tickets belong to a salon. Each message stores the author role and time. Unread messages are tracked separately for the salon and the platform. A salon reply reopens a resolved ticket.
- The support phone number is empty until the platform owner saves one. The salon page then shows a readable number and a `tel:` link. Messages and the phone number stay in local demo storage.

Demo data lives in versioned `localStorage` (`slmanager.data.v1` and `slmanager.session.v1`).

## Demo limitations

- There are no real accounts, passwords, or server checks.
- A salon owner is not isolated by a database. The screen filters records and the demo mutations reject another salon id. That is not production tenant security.
- Anyone with access to the browser can edit `localStorage` or call the page as the other role after logging in.
- Subscriptions are manual. There is no payment provider, invoice, or dunning.
- The product does not claim personalliggare, payroll, commission, or booking support.

## Client preview

The app is a static site. There is no server and no shared database. Each visitor gets fictional sample data in their own browser (`localStorage`). Routes use a hash (`/#/plattform`) so a refresh stays on the same dashboard page when the site is hosted from `/SLmanager/` on GitHub Pages.

GitHub Actions builds with `npm ci` and publishes the `dist` folder. The workflow is `.github/workflows/pages.yml`. The public demo address, after Pages is enabled, is `https://mostafayasin-source.github.io/SLmanager/`.

## Next phase

Replace the demo session with backend authentication and server-enforced authorization. Store salons, employees, shifts, attendance, and corrections in a database that isolates every query and mutation by salon id. Record subscription state on the server, and only then connect a payment provider. The browser should treat locked schedules as a consequence of that server state, not as a local flag.
