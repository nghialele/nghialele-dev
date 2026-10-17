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

Build the site with `pnpm build`. Push to `master` and Cloudflare Pages will do the little cloud dance by building and deploying the site automatically. No `deploy` branch juggling, no GitHub Action upload relay.

### Connect Cloudflare Pages

This project uses **Cloudflare Pages Git integration**. Cloudflare connects directly to this GitHub repository, builds it there, and deploys the generated site. You do **not** need the old GitHub Actions deployment workflow or Cloudflare API secrets in GitHub Actions.

#### 1. Connect the repository

In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**, choose GitHub, and select this repository.

Use these build settings:

- **Production branch:** `master`
- **Framework preset:** `Astro`
- **Build command:** `pnpm build`
- **Build output directory:** `dist`
- **Root directory:** leave blank (the Astro project is at the repository root)

#### 2. Configure the Node and pnpm versions

Add these environment variables in the Cloudflare Pages project under **Settings → Environment variables** for both **Production** and **Preview**:

- `NODE_VERSION` = `22`
- `PNPM_VERSION` = `9`

Cloudflare will install dependencies, run the build, and publish the result whenever you push to `master`. Pull requests and other branches can receive preview deployments too. Tiny site, big cloud energy.

#### 3. Push

Once the Cloudflare project is connected and the build settings are saved, push to `master`. Cloudflare will deploy the commit automatically. You can watch the build logs in the Pages project dashboard.

For details, see Cloudflare's [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) and [Astro deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/).

This site is based on [wqqz.dev](https://github.com/imwqqz/wqqz.dev). Thanks to [@imwqqz](https://github.com/imwqqz) for creating the original project.

See the [license](LICENSE) and [code of conduct](CODE_OF_CONDUCT.md).