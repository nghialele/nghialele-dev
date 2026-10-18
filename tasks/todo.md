# Tasks: Uses and Services pages

- [x] Add `/uses` using the owner's approved skills categories.
  - Acceptance: The page renders all existing categories and items from the public profile, with no unconfirmed technology claims.
  - Verify: `pnpm build`; inspected generated `/uses/index.html` and verified the mobile-width page in a browser.
  - Files: `src/pages/uses/index.astro`
- [x] Add `/services` using factual service areas in the profile, with a contact link rather than invented service listings.
  - Acceptance: Hosted tools/software, relays/proxies, and IT support are represented accurately; visitors can contact the owner for details.
  - Verify: `pnpm build`; inspected generated `/services/index.html` and verified the page/contact destination in a browser.
  - Files: `src/pages/services/index.astro`
- [x] Link both pages in the primary navigation and verify the complete change.
  - Acceptance: Both navigation links work and active-page indication is retained; links can wrap on narrow viewports.
  - Verify: `pnpm check` (0 errors) and `pnpm build` succeeded; inspected generated pages; mobile browser smoke check reported no console errors.
  - Files: `src/components/Navigation.astro`

## Live uses and services follow-up
- [x] Issue #3 uses redesign: local brand logos, responsive cloud tiles, and explicit Discord presence fallback.
- [x] Issue #4 services redesign: catalog-driven service cards, public/private access sections, and Kener status fallback.
- [x] Typed Kener and Lanyard adapters with fixture checks.
- [x] `pnpm check`, `pnpm build`, and browser smoke verification completed.
- [ ] Replace the empty services catalog with actual hosted services and confirmed access/status endpoint details.
