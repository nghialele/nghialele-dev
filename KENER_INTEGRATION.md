# Kener integration

This site is a static Astro site deployed through Cloudflare Pages. Kener integration is intentionally optional: the services catalog and links render without Kener, while status badges update when a safe status endpoint is configured.

## Kener features used

Kener v4 supports public monitor sharing through badges and embeds. The official sharing guide documents:

- Status and dot badges generated from **Manage → Badges**.
- Status bar, latency chart, and live-events embeds generated from **Manage → Embed**.
- Monitor-level and site-level sharing controls. Both must allow sharing before the public monitor page exposes those actions.

References:

- Kener v4 sharing: <https://kener.ing/docs/raw/v4/sharing.md>
- Kener v4 API specification: <https://kener.ing/docs/spec/v4/spec.json>
- Kener v4 monitor page endpoint: `GET /api/v4/pages/{page_path}`

## Service catalog configuration

Edit `src/data/services.json`. Keep hosted-service records separate from identity, contact, presence, and resume metadata in `public/0user.json`. Add one object per service; do not publish a placeholder as a real service.
The `/uses` page reads its curated technology categories from `src/data/uses.json`. Keep this file limited to the tools and practices you want displayed publicly; resume skills in `public/0user.json` remain separate.

```json
{
  "id": "example-service",
  "name": "Example service",
  "description": "What the service does and who it is for.",
  "published": true,
  "icon": "docker",
  "publicAccess": {
    "available": true,
    "url": "https://service.example.com",
    "label": "Open service",
    "instructions": "Any public usage or signup instructions.",
    "external": true
  },
  "privateAccess": {
    "available": true,
    "instructions": "Request an account or invitation by email.",
    "requestHref": "mailto:lele@nghia.im"
  },
  "status": {
    "monitorId": "example-service",
    "label": "Status unavailable",
    "badgeUrl": "https://status.example.com/badge/example-service/status",
    "embedUrl": "https://status.example.com/embed/monitor-example-service"
  }
}
```

`monitorId` must match the Kener monitor **tag**, not its display name or database ID. The badge and embed URLs should be copied from Kener’s sharing UI after verifying the monitor’s public sharing settings. The site renders these as links; it does not inject arbitrary HTML or third-party scripts.

## Cloudflare Pages Function

The safe status architecture is:

```text
Browser → https://your-site.example/api/status
       → Cloudflare Pages Function
       → Kener v4 API with Bearer token
```

The browser must never receive the Kener Bearer token. The Pages Function should be added at:

```text
functions/api/status.ts
```

Pages Functions use file-based routing, so this file maps to `/api/status`.

The Function should:

1. Accept only `GET` (and optionally `OPTIONS` if CORS is needed; same-origin requests do not need CORS).
2. Read Kener credentials from `context.env`, never from `public/0user.json` or client JavaScript.
3. Request the configured Kener page endpoint with `Accept: application/json` and `Authorization: Bearer <KENER_API_TOKEN>`.
4. Validate the response before using it.
5. Select only monitors whose `tag` appears in the site's published service catalog.
6. Return a small sanitized payload:

```json
{
  "services": {
    "example-service": {
      "status": "operational",
      "label": "Operational"
    }
  }
}
```

7. Map Kener states as follows:

| Kener | Site |
| --- | --- |
| `UP` | `operational` |
| `DEGRADED` | `degraded` |
| `DOWN` | `outage` |
| `MAINTENANCE` | `degraded` |
| `NO_DATA` | `unknown` |

8. Return `unknown` for missing monitors, malformed JSON, non-2xx responses, timeouts, or network errors. Do not return raw Kener data or error details.
9. Use a bounded upstream timeout and a short cache, for example `Cache-Control: public, max-age=30`.

The browser adapter is designed for the sanitized contract, but the repository does not yet contain `functions/api/status.ts`; local testing of that route is the next implementation step. Service records live in `src/data/services.json`, and uses records live in `src/data/uses.json`.

## Cloudflare configuration

In the Cloudflare Pages project, configure these under **Settings → Environment variables** for the environments that need status checks:

### Encrypted secret

```text
KENER_API_TOKEN=<Kener API bearer token>
```

### Non-secret variables

```text
KENER_API_BASE_URL=https://status.example.com
KENER_PAGE_PATH=services
```

The Function constructs:

```text
${KENER_API_BASE_URL}/api/v4/pages/${KENER_PAGE_PATH}
```

Do not commit these values to the repository when they contain private hostnames or credentials. Use separate Production and Preview values if your preview environment uses a different Kener instance.

## Local testing

Install the project dependencies, then use Wrangler’s Pages local runtime so `context.env` behaves like a Pages Function. The exact local command depends on the Cloudflare project configuration, but the target is equivalent to:

```sh
pnpm build
pnpm exec wrangler pages dev dist
```

Provide local variables through a `.dev.vars` file that is ignored by Git:

```dotenv
KENER_API_TOKEN=replace-with-a-local-test-token
KENER_API_BASE_URL=https://status.example.com
KENER_PAGE_PATH=services
```

Never use a production token in a shared `.dev.vars` file or commit it. Test the route with:

```sh
curl -i http://127.0.0.1:8788/api/status
```

Expected results:

- `200` and sanitized status JSON when Kener responds.
- `200` and `unknown` statuses when Kener is unavailable, if the Function is configured to fail soft.
- No Bearer token in the response body, generated HTML, or browser network request to `/api/status`.

## Deployment checklist

- [ ] Add real `published: true` service entries and verify every public/private access instruction.
- [ ] Create/verify Kener monitors and record their tags.
- [ ] Enable site-level and monitor-level badge/embed sharing in Kener.
- [ ] Add `functions/api/status.ts` and route configuration to the branch.
- [ ] Add `KENER_API_TOKEN` as an encrypted Pages secret.
- [ ] Add `KENER_API_BASE_URL` and `KENER_PAGE_PATH` as Pages variables.
- [ ] Test `/api/status` locally with Wrangler.
- [ ] Deploy a preview and verify the status badges, public links, private request links, and Kener badge/embed links.
- [ ] Confirm no token or raw Kener response is visible in DevTools.

## Security boundary

Kener’s v4 API is Bearer-authenticated by default. Never solve that by putting the token in Astro public environment variables, `public/0user.json`, a client-side script, or an HTML attribute. The Pages Function is the trust boundary: it is the only place that may hold the token and the only code that talks to the authenticated Kener API.
