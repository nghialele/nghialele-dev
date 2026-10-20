# Kener integration

The site is static and deployed on Cloudflare Pages. The monitors attached to a **Kener page** decide which services appear; `src/data/services.json` only orders them and supplies presentation overrides. A Pages Function resolves the page and enriches each card with live data. Credentials come from environment variables, never from committed files.

## How it works

```text
Browser → /api/services
       → Cloudflare Pages Function (Bearer token from env)
       → Kener v4 API  GET /api/v4/pages/{page_path}   (membership + order)
                       GET /api/v4/monitors            (name, description, url)
                       GET /api/v4/monitors/{tag}/data (live status)
       → { services: { tag: { name, description, url, status, position } },
           pageResolved: true }
```

- The Kener page decides **which** monitors are public and their default order.
- `services.json` reorders the ones it names and adds icon, instructions, request access, and URL overrides.
- A monitor on the page but absent from `services.json` still appears, with a generic icon and no extras.
- Monitors marked `is_hidden = YES` in Kener are excluded even when attached to the page.
- A Kener monitor that is not on the page never appears, regardless of `services.json`.

Adding a service is a single Kener edit: attach the monitor to the page. No redeploy is needed.


## Service catalog configuration

`src/data/services.json` holds only ordering and optional overrides:

```json
[
    {
        "id": "searxng",
        "icon": "searxng",
        "instructions": "Set it as your default search engine."
    },
    {
        "id": "hycanvas",
        "url": "https://canva.nghia.im",
        "requestAccess": true,
        "instructions": "Private instance. Ask me for access."
    }
]
```

Field notes:

- `id` (required) must equal a Kener monitor tag that is attached to the page. It links an override to a monitor.
- `icon` (optional) selects a brand logo from `src/components/BrandIcon.astro`. Omit it for the generic fallback.
- `name` (optional) is the heading shown before Kener responds. Once Kener answers, its monitor name wins.
- `url` (optional) overrides Kener's `external_url`. Use it when the monitor checks a health endpoint rather than the page visitors should open.
- `instructions` (optional) is a short curated note rendered under the title.
- `requestAccess` (optional) adds a "Request access" link pointing at the contact email.

Array order sets card order for the ids it lists; monitors it does not list follow, in Kener page order. Everything else — description, live status, and the public URL — comes from Kener. Do not duplicate it here.

To hide a service, detach the monitor from the Kener page (or mark it hidden in Kener). Removing a JSON entry only drops its overrides.


## The Pages Function

`functions/api/services.ts` maps to `/api/services` through file-based routing and is the only code that holds the token.

1. Accepts `GET /api/services` (no query parameters).
2. Reads `KENER_API_TOKEN`, `KENER_API_BASE_URL`, and `KENER_PAGE_PATH` from `context.env`.
3. Calls `GET /api/v4/pages/{page_path}` to read `page.monitors`, each `{ monitor_tag, position }`, sorted by `position`.
4. Calls `GET /api/v4/monitors` with `Accept: application/json` and `Authorization: Bearer <token>`, with a 5-second timeout, and indexes monitors by `tag`.
5. Emits one entry per page member that has a matching monitor and whose `is_hidden` is not `"YES"`, in page order.
6. For each emitted monitor, calls `GET /api/v4/monitors/{tag}/data?start_ts=…&end_ts=…` over the last 24 hours and takes the newest data point's status. With no data point, it falls back to the monitor's `default_status`.
7. Returns:

```json
{
  "services": {
    "searxng": {
      "name": "SearXNG",
      "description": "A metasearch engine.",
      "url": "https://searx.example.com",
      "status": "operational",
      "position": 4
    }
  },
  "pageResolved": true
}
```

8. Maps Kener states:

| Kener | Site |
| --- | --- |
| `UP` | `operational` |
| `DEGRADED` | `degraded` |
| `DOWN` | `outage` |
| `MAINTENANCE` | `degraded` |
| `NO_DATA` | `unknown` |

`ACTIVE` and `INACTIVE` are monitor enablement flags, **not** health states; the function never maps them. Listing `status=ACTIVE` on a monitor does not mean the service is up.

9. Fails soft: missing configuration, a non-2xx page or monitor response, invalid JSON, a timeout, or a network error all return `200` with `{"services":{},"pageResolved":false}`. The page then keeps the catalog cards it rendered at build time, with no description, status, or link. An empty page returns `{"services":{},"pageResolved":true}` and the client removes the build-time cards.
10. Sends `cache-control: public, max-age=30` and `x-content-type-options: nosniff`.

`public/_routes.json` limits Functions to `/api/*`:

```json
{
    "version": 1,
    "include": ["/api/*"],
    "exclude": []
}
```

## Environment variables

Locally, put these in `.env.local` at the repository root (ignored by Git):

```dotenv
KENER_API_TOKEN=your-token
KENER_API_BASE_URL=https://status.example.com
KENER_PAGE_PATH=~home
```

In Cloudflare Pages, add the same three under **Settings → Environment variables** for each environment. Mark `KENER_API_TOKEN` as **encrypted**.

- `KENER_API_TOKEN` — Kener API bearer token.
- `KENER_API_BASE_URL` — Kener origin, without a trailing slash (a trailing slash is stripped anyway).
- `KENER_PAGE_PATH` — the Kener page `page_path`, which is the URL slug, not the display title. A page titled "main" can have `page_path` `~home`; read it from `GET /api/v4/pages`.

A tracked `.env.example` holds the same keys with empty values; never commit real ones.

## Local testing

`astro preview` serves static files only, so `/api/services` returns `404` there and the page falls back to plain catalog ids. That is expected.

To run the Function locally:

```sh
pnpm build
pnpm preview:cf
```

`preview:cf` runs `wrangler pages dev dist --env-file .env.local`, so the Function receives the variables above. Then:

```sh
curl -s "http://127.0.0.1:8788/api/services"
```

Expected:

- `200` with `{"services":{...},"pageResolved":true}` and a `cache-control` header when Kener responds.
- `200` with `{"services":{},"pageResolved":false}` when Kener is unreachable or misconfigured.
- The token in neither the body nor the headers.

`wrangler pages dev` also loads `.env.local` on top of `--env-file`, so a second env file cannot blank out a variable that `.env.local` defines. To exercise the failure path, point `KENER_PAGE_PATH` at a page that does not exist, e.g. `--binding KENER_PAGE_PATH=missing-page`.

## Deployment checklist

- [ ] Every catalog `id` matches a monitor attached to the Kener page.
- [ ] `KENER_PAGE_PATH` matches the page's `page_path` slug.
- [ ] `functions/api/services.ts` and `public/_routes.json` are deployed.
- [ ] `KENER_API_TOKEN` is set as an encrypted Pages secret.
- [ ] `KENER_API_BASE_URL` and `KENER_PAGE_PATH` are set as Pages variables.
- [ ] `pnpm preview:cf` returns only monitors attached to the page.
- [ ] A preview deployment shows Kener names, descriptions, statuses, and URLs.
- [ ] No token or raw Kener response is visible in DevTools.

## Security boundary

Kener's v4 API is Bearer-authenticated by default. Never place the token in Astro public variables, `public/0user.json`, `src/data/services.json`, client scripts, or HTML attributes. `functions/api/services.ts` is the trust boundary: it holds the token and is the only code calling the authenticated Kener API. The browser only receives the sanitized response for the monitors attached to the configured page.
