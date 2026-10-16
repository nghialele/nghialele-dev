# nghialele.dev

A personal site and blog built with Astro.

## Run locally

Install Node.js 22 and pnpm, then run:

```sh
pnpm install
pnpm dev
```

Open the local address printed in your terminal.

## Make it yours

- Edit `public/0user.json` to update the site details, contact links, and resume.
- Add or edit posts in `src/content/archives/`.
- Change colors in `src/styles/global.css`.

Build the site with `pnpm build`. Push to `master` and Cloudflare Pages will do the little cloud dance: GitHub Actions builds the site and sends `dist/` to Cloudflare Pages. No more `deploy` branch juggling.

### Connect Cloudflare Pages

1. Create a **Pages** project in the Cloudflare dashboard using **Direct Upload**. Give it a project name; the workflow needs that exact name.
2. In your GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:
   - `CLOUDFLARE_API_TOKEN` — an API token with **Account → Cloudflare Pages → Edit** permission.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
   - `CLOUDFLARE_PAGES_PROJECT_NAME` — the Pages project name from step 1.
3. Push to `master` (or manually run **Deploy to Cloudflare Pages** from the Actions tab). Watch the workflow ship your site to the edge. Tiny site, big cloud energy.

Cloudflare's [Pages CI guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) has screenshots and token details if the dashboard starts playing hide-and-seek.

See the [license](LICENSE) and [code of conduct](CODE_OF_CONDUCT.md).