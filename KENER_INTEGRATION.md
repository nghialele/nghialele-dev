# Kener integration

The site is static and deployed on Cloudflare Pages. `src/data/services.json` lists only the **Kener monitor tags** to show; a Pages Function fetches those monitors from Kener and the card is rendered from that response. Credentials come from environment variables, never from committed files.

## How it works

```text
Browser → /api/services?ids=searxng,hycanvas
       → Cloudflare Pages Function (Bearer token from env)
       → Kener v4 API  GET /api/v4/monitors
                       GET /api/v4/monitors/{tag}/data
       → { services: { tag: { name, description, url, status } } }
```

- `services.json` decides **which** monitors are public and holds optional extras (icon, URL override, access note).
- Kener supplies the service **name, description, URL, and live status**.
- A Kener monitor whose tag is not listed in `services.json` is never returned.

## Service catalog configuration

`src/data/services.json` contains only the ids and optional overrides, so it stays tiny:

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

- `id` (required) must equal the Kener monitor tag. It is the only thing that links the site to Kener.
- `icon` (optional) selects a brand logo from `src/components/BrandIcon.astro`. Omit it for the generic fallback.
- `name` (optional) overrides the card heading before Kener responds. Without it, the id is shown.
- `url` (optional) overrides Kener's `external_url`. Use it when the monitor checks a health endpoint rather than the page visitors should open.
- `instructions` (optional) is a short curated note rendered under the title.
- `requestAccess` (optional) adds a "Request access" link pointing at the contact email.

Everything else — description, live status, and the public URL — comes from Kener. Do not duplicate it here.

To hide a service, remove its entry. To add one, create the monitor in Kener and add its tag.

## The Pages Function

`functions/api/services.ts` maps to `/api/services` through file-based routing and is the only code that holds the token.

1. Accepts `GET /api/services?ids=<comma-separated tags>`.
2. Reads `KENER_API_TOKEN` and `KENER_API_BASE_URL` from `context.env`.
3. Calls `GET /api/v4/monitors` with `Accept: application/json` and `Authorization: Bearer <token>`, with a 5-second timeout.
4. Keeps monitors whose `tag` was requested and whose `is_hidden` is not `"YES"`.
5. For each remaining monitor, calls `GET /api/v4/monitors/{tag}/data?start_ts=…&end_ts=…` over the last 24 hours and takes the newest data point's status. With no data point, it falls back to the monitor's `default_status`.
6. Returns:

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

7. Maps Kener states:

| Kener | Site |
| --- | --- |
| `UP` | `operational` |
| `DEGRADED` | `degraded` |
| `DOWN` | `outage` |
| `MAINTENANCE` | `degraded` |
| `NO_DATA` | `unknown` |

`ACTIVE` and `INACTIVE` are monitor enablement flags, **not** health states; the function never maps them. Listing `status=ACTIVE` on a monitor does not mean the service is up.

8. Fails soft: missing configuration, an empty `ids`, a non-2xx response, invalid JSON, a timeout, or a network error all return `200` with `{"services":{}}`. The page then shows the catalog ids with no description, status, or link.
9. Sends `cache-control: public, max-age=30` and `x-content-type-options: nosniff`.

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
```

In Cloudflare Pages, add the same two under **Settings → Environment variables** for each environment. Mark `KENER_API_TOKEN` as **encrypted**.

- `KENER_API_TOKEN` — Kener API bearer token.
- `KENER_API_BASE_URL` — Kener origin, without a trailing slash (a trailing slash is stripped anyway).

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
curl -s "http://127.0.0.1:8788/api/services?ids=searxng,hycanvas"
```

Expected:

- `200` with `{"services":{...}}` and a `cache-control` header when Kener responds.
- `200` with `{"services":{}}` when Kener is unreachable or misconfigured.
- The token in neither the body nor the headers.

## Deployment checklist

- [ ] Every catalog `id` matches an existing Kener monitor tag.
- [ ] `functions/api/services.ts` and `public/_routes.json` are deployed.
- [ ] `KENER_API_TOKEN` is set as an encrypted Pages secret.
- [ ] `KENER_API_BASE_URL` is set as a Pages variable.
- [ ] `pnpm preview:cf` returns only expected monitors.
- [ ] A preview deployment shows Kener names, descriptions, statuses, and URLs.
- [ ] No token or raw Kener response is visible in DevTools.

## Security boundary

Kener's v4 API is Bearer-authenticated by default. Never place the token in Astro public variables, `public/0user.json`, `src/data/services.json`, client scripts, or HTML attributes. `functions/api/services.ts` is the trust boundary: it holds the token and is the only code calling the authenticated Kener API. The browser only receives the sanitized response for ids the page already knows.
