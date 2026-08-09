// @ts-check
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// The production domain, which `site` below feeds to canonical, OG, JSON-LD, the sitemap,
// robots.txt and llms.txt — six things one wrong value poisons at once, and none of them visibly
// broken in review. A fresh clone builds on the placeholder so a buyer can see the site before
// owning a domain; a production deploy refuses to, so the placeholder cannot reach a live domain.
//
// This template is host-agnostic, so "is this a production deploy?" reads each host's own build
// variable rather than assuming one. None of these is set by a local `pnpm build` or by a deploy
// preview, so previews and local work build freely. On a host not listed here, set DEPLOY_ENV
// yourself (see .env.example) — the gate is only as good as the signal it can see.
const site = process.env.SITE_URL ?? "https://EstebanPereiraT.github.io";
const isProductionDeploy =
  process.env.CONTEXT === "production" || // Netlify
  process.env.VERCEL_ENV === "production" || // Vercel
  process.env.DEPLOY_ENV === "production"; // anything else — set it in your host's build env

// Match the placeholder by exact hostname, not `site.includes("example.com")` — a substring test both
// misses real domains that merely contain it and green-lights hosts like `example.com.evil.test`. An
// unparseable SITE_URL is treated as still-placeholder so a malformed value fails the gate too.
const placeholderHosts = new Set(["example.com", "www.example.com"]);
const hostname = URL.canParse(site) ? new URL(site).hostname : "example.com";
if (isProductionDeploy && placeholderHosts.has(hostname)) {
  throw new Error(
    "SITE_URL is unset or still the placeholder. Set it to your production domain in your " +
      "host's environment variables before deploying.",
  );
}

// https://astro.build/config
export default defineConfig({
  site,

  // The site is static EXCEPT one page: `/contact/` sets `export const prerender = false` because
  // it receives the Resend form POST and re-renders itself with the result.
  // That single on-demand route is the only thing the Cloudflare Worker ever runs; every other
  // route still prerenders to HTML and is served as a static asset (see wrangler.jsonc). Swap this
  // for `@astrojs/node` / `@astrojs/netlify` / `@astrojs/vercel` in two lines if the host changes
  // (nothing else knows which adapter is mounted). Drop the contact form and remove this line to go
  // fully static again.
  adapter: cloudflare(),

  // The contact action's mail keys, declared through `astro:env` so they resolve at REQUEST time on
  // every adapter — on Cloudflare Workers, secrets exist only in the runtime env (`wrangler secret`),
  // which `import.meta.env` never sees. All optional: a missing key must not break the build; the
  // action logs which key is missing to the server and answers the visitor with its generic
  // send-failure message instead (see src/actions/index.ts).
  env: {
    schema: {
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: "server", access: "secret", optional: true }),
      CONTACT_FROM_EMAIL: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },

  // One canonical URL shape: the directory build emits trailing slashes, and canonical + OG agree
  // on that shape.
  trailingSlash: "always",

  // mdx() renders .mdx content.
  // sitemap filter: never list noindex pages — the dev-only /examples catalog and 404s
  // both set `noindex` in the markup, so a sitemap entry for them would contradict it.
  // customPages: the sitemap can't enumerate the on-demand `/contact/` route (it emits no static
  // file), so it's added by hand — the one manual entry seo.md prescribes for SSR routes.
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/examples/") && !page.includes("/404/"),
      customPages: [new URL("/contact/", site).href],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    // Stop inlining short scripts so they don't break under <ClientRouter /> view transitions.
    build: {
      assetsInlineLimit: 0,
    },
  },
});
