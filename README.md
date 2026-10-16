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

This workflow uses **Direct Upload**, not Cloudflare's Git integration. Cloudflare does **not** need to import or upload this GitHub repository. GitHub Actions builds the site and uploads only the generated `dist/` folder.

#### 1. Create an empty Pages project

The clearest way is with Wrangler. Run this locally from the repository:

```sh
pnpm dlx wrangler pages project create nghialele-dev --production-branch master
```

Replace `nghialele-dev` with the Pages project name you want. This command creates the empty project; it does not upload your source code. If Wrangler asks you to log in, follow its browser prompt. The project will be available at `<project-name>.pages.dev` after the first deployment.

You can also create the project in Cloudflare's dashboard: **Workers & Pages → Create application → Get started → Drag and drop your files**. The dashboard may ask for an initial upload; if it does, run `pnpm build` and upload the `dist/` folder—not the repository. The GitHub Action will replace that deployment on the next push.

#### 2. Add GitHub secrets

In your GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

- `CLOUDFLARE_API_TOKEN` — an API token with **Account → Cloudflare Pages → Edit** permission.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
- `CLOUDFLARE_PAGES_PROJECT_NAME` — the exact project name from step 1.

#### 3. Deploy

Push to `master` (or manually run **Deploy to Cloudflare Pages** from the Actions tab). GitHub Actions installs dependencies, runs `pnpm build`, and uploads `dist/` to your existing Cloudflare Pages project. Tiny site, big cloud energy.

Cloudflare's [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/) explains the project-creation options, and its [Pages CI guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) covers GitHub secrets and the workflow.

See the [license](LICENSE) and [code of conduct](CODE_OF_CONDUCT.md).