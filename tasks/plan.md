# Plan: Uses and Services pages

## Overview
Add two small, static Astro pages requested in issue #2: `/uses` for the technologies and tools in Nghia's stack, and `/services` for the public services he hosts. Both pages should fit the existing site navigation and visual patterns.

## Decisions
- Implement each page as an Astro route using `Base` and the existing Tailwind design tokens; no new dependencies or client-side code.
- Add `/uses` and `/services` to the existing primary navigation and mark the current route with the existing active-link behavior.
- Build `/uses` from the owner-approved public profile skill categories.
- Build `/services` from factual service areas already stated in the profile (tools/software, relays/proxies, and IT support); do not invent product names or URLs. Invite visitors to contact the owner for details.
- Use icons from the already-installed `@lucide/astro` package as lightweight, dependency-free inline SVGs rather than external logo services. These are category icons, not service-brand logos.
- Service-specific names, URLs, and availability can be added once the owner provides them; do not make up public listings.

## Tasks

### Phase 1: Page implementation
1. Add `/uses`, organized into the skill categories published in the public profile.
2. Add `/services` with accurate categories drawn from the existing profile and a way to ask about details.
3. Add both routes to the primary navigation; preserve its active-page indication and ensure it wraps cleanly on narrow screens.

### Checkpoint
- `pnpm check` and `pnpm build` succeed.
- Built output contains `/uses` and `/services`, active navigation states, profile skill categories, and the factual service areas.
- Browser smoke check at a narrow viewport confirms both pages render and navigation wraps without overflow; no browser console errors were observed.

### Phase 2: Close the request
- Close issue #2 after successful build and browser verification. **Done:** issue #2 was closed after both routes were verified.

## Risks and mitigation
- **Service details are unspecified:** Show only the broad service areas already published by the owner and a contact path; avoid fabricated names, URLs, availability, or access instructions.
- **Navigation crowding:** Keep labels concise and allow navigation links to wrap on narrow screens.

## Owner-confirmed decisions
- Use the public profile's skill list for `/uses`.
- Use accurate editable categories rather than fictitious service listings until specific service names/URLs are ready.
- Use the existing Lucide icon package for generic category icons; no third-party logo service or new dependency.

## Completion
- Both pages are implemented and verified. Issue #2 is closed; specific service names and public URLs can be added when supplied by the owner.