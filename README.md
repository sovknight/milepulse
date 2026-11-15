# MilePulse

A mobile-first, installable web app (PWA) for tracking vehicle odometer readings and
projecting mileage milestones. Local-first: all data lives in the browser's IndexedDB.
No account, no server.

## Commands

    npm install
    npm run dev       # local dev server
    npm test          # unit tests (domain logic)
    npm run build     # typecheck + production build into dist/
    npm run preview   # serve the production build locally

## Deploying

`dist/` is a static site. Host it anywhere that serves HTTPS (GitHub Pages, Netlify,
Cloudflare Pages). HTTPS is required for the service worker and for installing to a
phone's home screen. The build uses relative paths, so a sub-path such as
`user.github.io/milepulse/` works without changes.

## Layout

    src/domain/   Pure logic, no browser APIs beyond Date: dates, projections, backup, CSV. Unit tested.
    src/db.ts     IndexedDB access (via idb). Bump the version number when adding stores.
    src/ui/       Preact components.
    src/app.tsx   Hash router and tab bar.
    public/icons  App icons (icon.svg is the source).

## Design decisions

- Dates are local calendar days stored as `YYYY-MM-DD`; arithmetic uses whole day numbers.
- Odometer readings are stored exactly as entered, in the vehicle's own unit (mi or km).
- Projections use the last 90 days of readings when they span 14+ days, otherwise all readings.
- Backups are a single JSON file; importing replaces all data on the device.

## Roadmap

Scope decision: MilePulse is an odometer and pace tracker. There is no trip log.

1. Optional: cloud sync
