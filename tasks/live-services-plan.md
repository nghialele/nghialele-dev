# Plan: Live uses and services pages

## Overview
Implement issue #3's richer uses page and issue #4's real hosted-service catalog. The site remains a static Astro build: catalog data is maintained in `public/0user.json`, brand SVGs are bundled locally with `simple-icons`, and optional Kener/Lanyard integrations run only when public client-safe endpoints are configured.

## Completed implementation
- Added typed `uses`, `services`, presence, access, and status models in `src/lib/info.ts`.
- Added curated uses data and an empty services catalog in `public/0user.json`; no fictional services are published.
- Added local Simple Icons rendering with a Lucide fallback in `src/components/BrandIcon.astro`.
- Redesigned `/uses` with responsive cloud-style tiles and an explicit unavailable Discord presence state.
- Redesigned `/services` with published-entry filtering, public/private access sections, an empty state, and status badges.
- Added defensive browser adapters in `src/lib/presence.ts` and `src/lib/kener.ts`, plus `PresenceCard.astro` and `ServiceStatus.astro`.

## Verification completed
- `pnpm check` passes with 0 errors; 6 pre-existing hints remain in `src/pages/archives/[slug].astro`.
- `pnpm build` succeeds and generates `/uses` and `/services`.
- Browser smoke test at 390px verified the uses cloud layout, accessible logo labels, unavailable presence state, services empty state, contact link, and no browser console errors.
- Kener fixture: matching `up` monitor → `operational`; malformed response → `unknown`.
- Presence fixture: valid online response → `online` with display name/activity; missing configuration → `unavailable` without a request.
- Generated HTML does not contain an empty private endpoint attribute.

## Remaining owner inputs
- Replace `services: []` with real entries in `public/0user.json`. Each published entry needs its name, description, icon key, public URL/instructions, private/request instructions, and Kener monitor ID. Keep `published: false` until the entry is accurate.
- Supply a client-safe Lanyard endpoint and Discord user ID under `presence`; leave both empty to intentionally show unavailable.
- Supply a client-safe Kener JSON endpoint under `status.endpoint` and confirm its response shape. The adapter currently accepts an array or `{ monitors: [...] }` with each monitor `{ id, status }`; unknown shapes safely remain unavailable.
- Issues #3 and #4 should remain open until the actual catalog and endpoint contracts are supplied and verified in production-like browser conditions.
