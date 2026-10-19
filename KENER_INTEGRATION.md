# Kener integration

This site is a static Astro site deployed through Cloudflare Pages. `src/data/services.json` is the allowlist of services to display; a Cloudflare Pages Function fetches matching monitor data from Kener so the cards can show Kener's real name, description, status, and service URL. The static catalog is always rendered, so the page still works when Kener, the Function, or JavaScript is unavailable.

## How the pieces fit together

```text
Browser → /api/services?ids=searxng
       → Cloudflare Pages Function (Bearer token lives here)
       → Kener v4 API  GET /api/v4/pages/{page_path}
       → sanitized { services: { tag: { name, description, url, status } } }
```

- `src/data/services.json` decides **which** services exist and holds curated access instructions and an icon.
- Kener supplies the **name, description, status, and external URL** for each matching monitor.
- A monitor present in Kener but absent from `services.json` is never rendered.
- `id` in the catalog **is** the Kener monitor tag.

References:

- Kener v4 sharing: <https://kener.ing/docs/raw/v4/sharing.md>
- Kener v4 API specification: <https://kener.ing/docs/spec/v4/spec.json>
- Kener v4 monitor page endpoint: `GET /api/v4/pages/{page_path}`

## Service catalog configuration

Edit `src/data/services.json`. Keep hosted-service records separate from identity, contact, presence, and resume metadata in `public/0user.json`. The committed file contains the published `searxng` entry; add every additional service as its own object.

The `/uses` page reads its curated technology categories from `src/data/uses.json`. Keep that file limited to the tools and practices you want displayed publicly; resume skills in `public/0user.json` remain separate.

```json
[
    {
        "id": "searxng",
        "name": "SearXNG",
        "description": "SearXNG is a metasearch engine, aggregating the results of other search engines while not storing information about its users.",
        "published": true,
        "icon": "searxng",
        "publicAccess": {
            "available": true,
            "url": "https://searx.githo.st",
            "label": "searx.githo.st",
            "instructions": "Set it as your default search engine.",
            "external": true
        },
        "privateAccess": {
            "available": false
        }
    }
]
```

Field notes:

- `id` must equal the Kener monitor tag. If the tag differs from the display name, only this value changes.
- `published` controls whether the service appears on `/services`; unpublished records are ignored.
- `name` and `description` are the static fallback text shown before Kener responds and when it cannot be reached. Kener overwrites them at runtime when it returns those fields.
- `icon` is optional. If present, use a key supported by `src/components/BrandIcon.astro`; omit it to use the generic Lucide fallback.
- `publicAccess.available` controls whether the access block renders; a clickable link additionally requires a non-empty `url`. With `available: true` and no `url`, the label renders as plain text.
- `privateAccess` content renders only when `available: true`. `requestHref` can be an email link or another request form URL.
- `status.badgeUrl` and `status.embedUrl` are optional links copied from Kener's sharing UI after public sharing is enabled.

## The Pages Function

`functions/api/services.ts` is the only code that talks to the authenticated Kener API. Pages Functions use file-based routing, so the file maps to `/api/services`.

Behavior:

1. Accepts `GET /api/services?ids=<comma-separated monitor tags>`.
2. Reads `KENER_API_TOKEN`, `KENER_API_BASE_URL`, and `KENER_PAGE_PATH` from `context.env`.
3. Requests `${KENER_API_BASE_URL}/api/v4/pages/${KENER_PAGE_PATH}` with `Accept: application/json` and `Authorization: Bearer <KENER_API_TOKEN>`, with a 5-second timeout.
4. Keeps only monitors whose `tag` was requested.
5. Returns a small sanitized payload:

```json
{
  "services": {
    "searxng": {
      "name": "SearXNG",
      "description": "A metasearch engine.",
      "url": "https://searx.example.com",
      "status": "operational"
    }
  }
}
```

6. Maps Kener states:

| Kener | Site |
| --- | --- |
| `UP` | `operational` |
| `DEGRADED` | `degraded` |
| `DOWN` | `outage` |
| `MAINTENANCE` | `degraded` |
| `NO_DATA` | `unknown` |

7. Fails soft: missing configuration, an empty `ids` parameter, a non-2xx response, invalid JSON, a timeout, or a network error all return `200` with `{"services":{}}`. The page then keeps its static content. Raw Kener data and error details are never returned.
8. Sends `cache-control: public, max-age=30` and `x-content-type-options: nosniff`.

`public/_routes.json` limits Function invocation to `/api/*`, so all other requests continue to be served as static assets:

```json
{
    "version": 1,
    "include": ["/api/*"],
    "exclude": []
}
```

## Cloudflare configuration

In the Cloudflare Pages project, configure these under **Settings → Environment variables** for every environment that should show live data:

### Encrypted secret

```text
KENER_API_TOKEN=<Kener API bearer token>
```

### Non-secret variables

```text
KENER_API_BASE_URL=https://status.example.com
KENER_PAGE_PATH=services
```

`KENER_PAGE_PATH` is the Kener page path used by `GET /api/v4/pages/{page_path}`. If it is unset, the Function returns no services and the page uses only static data; this prevents exposing the whole monitor list.

Do not commit private hostnames or credentials. Use separate Production and Preview values if the preview environment uses a different Kener instance.

## Local testing

`astro preview` serves only static assets, so `/api/services` returns `404` there. That is expected: the page falls back to static data and must not show errors.

To exercise the real Function, build the site and run it through Wrangler's Pages runtime:

```sh
pnpm build
pnpm preview:cf
```

Provide local variables in a `.dev.vars` file at the repository root (already ignored by Git):

```dotenv
KENER_API_TOKEN=replace-with-a-local-test-token
KENER_API_BASE_URL=https://status.example.com
KENER_PAGE_PATH=services
```

Then test the route:

```sh
curl -i "http://127.0.0.1:8788/api/services?ids=searxng"
```

Expected results:

- `200` with `{"services":{...}}` when Kener responds.
- `200` with `{"services":{}}` when Kener is unavailable or misconfigured.
- The token appears in neither the response body nor the response headers.

Never use a production token in a `.dev.vars` file that you share or commit.

## Deployment checklist

- [ ] Verify each catalog `id` matches its Kener monitor tag exactly.
- [ ] Fill in real access instructions for every published service.
- [ ] Add `functions/api/services.ts` and `public/_routes.json` to the deployment.
- [ ] Add `KENER_API_TOKEN` as an encrypted Pages secret.
- [ ] Add `KENER_API_BASE_URL` and `KENER_PAGE_PATH` as Pages variables.
- [ ] Run `pnpm preview:cf` locally and confirm `/api/services` returns only expected monitors.
- [ ] Deploy a preview and confirm the cards show Kener names, descriptions, statuses, and URLs.
- [ ] Confirm no token or raw Kener response is visible in DevTools.
- [ ] Confirm `/api/services` is the only route invoking a Function.

## Security boundary

Kener's v4 API is Bearer-authenticated by default. Never put the token in Astro public environment variables, `public/0user.json`, `src/data/services.json`, client-side scripts, or HTML attributes. `functions/api/services.ts` is the trust boundary: it is the only place that holds the token and the only code that calls the authenticated Kener API. The browser only ever sees the sanitized `/api/services` response for the ids the page already knows about.
