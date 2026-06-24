# Stretch Therapy Astro Site

Static Astro site for `https://stretchtherapy.sitetarik.com/`.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

## Project Notes

- The public pages are Astro routes that embed captured reference HTML.
- The `/join` route embeds the Zoho private assessment form.
- GTM and GA4 are loaded from Doppler-provided build env vars: `PUBLIC_GTM_CONTAINER_ID` or `PUBLIC_GTM_ID`, plus `PUBLIC_GA4_MEASUREMENT_ID` when a direct GA4 measurement ID is available.
- Custom events are namespaced with `stretchtherapy_` to keep them separate from generic SiteTarik tracking events.
