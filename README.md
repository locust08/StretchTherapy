# Stretch Therapy Astro Site

Static Astro site for `https://stretchtherapy.sitetarik.com/`.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm verify:analytics
```

When building with Doppler, use:

```sh
doppler run -- pnpm build
```

or:

```sh
pnpm build:doppler
```

## Analytics Configuration

GTM is the primary analytics integration.

- GTM container name: `LT Automation 6346744109 | Stretch Therapy GTM`
- GTM container ID: `GTM-5F3MLDMN`
- GA4 property / stream name: `LT Automation 389036374 | Stretch Therapy`
- GA4 property reference: `534874257`
- GA4 web stream name: `Stretch Therapy | stretchtherapy.sitetarik.com`
- Recommended GA4 comparison/filter name: `Hostname - stretchtherapy.sitetarik.com`

The GA4 property reference `534874257` is not a GA4 web measurement ID. Only set a GA4 measurement ID when the real web measurement ID is available in the `G-XXXXXXXXXX` format.

## Doppler Variables

Client-side analytics reads only public build-time variables:

```sh
PUBLIC_GTM_ID=GTM-5F3MLDMN
PUBLIC_GTM_CONTAINER_ID=GTM-5F3MLDMN
PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

The implementation also accepts the legacy prompt names as fallbacks:

```sh
NEXT_PUBLIC_GTM_ID=GTM-5F3MLDMN
NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-5F3MLDMN
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

Only one GTM variable is required. Prefer `PUBLIC_GTM_ID`.

The build also accepts `GTM_CONTAINER_ID` as a non-secret container ID alias when Doppler provides that instead of the public names.

Do not expose these Doppler server-side values to client code:

```sh
GA4_PROPERTY_ID
GA4_STREAM_ID
GOOGLE_API_KEY
GOOGLE_OAUTH_REFRESH_TOKEN
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_CLIENT_ID
```

## Runtime Behavior

When a valid GTM container ID is configured, the site loads GTM and sends custom events through `window.dataLayer`.

When GTM is not configured and a valid GA4 measurement ID is configured, the site loads direct GA4 through `gtag` as a fallback.

When both GTM and GA4 are configured, GTM wins and direct GA4 is not loaded, which avoids duplicate pageview and event firing.

## Conditional Events

Implemented event names are intentionally generic and should be separated in GA4/GTM reporting by hostname, not by event prefix:

```text
whatsapp_click
facebook_click
instagram_click
google_maps_click
lead_form_submit
```

The current site supports:

- `whatsapp_click`: WhatsApp links on contact/reference content.
- `facebook_click`: Facebook links in social sections.
- `instagram_click`: Instagram links in social sections.
- `google_maps_click`: Google Maps link on reviews/reference content.
- `lead_form_submit`: same-origin embedded forms after the submit event is not cancelled by validation.

Skipped because no matching link currently exists:

- `x_click`
- `tiktok_click`
- `linkedin_click`
- `waze_click`

The `/join` page embeds a Zoho form in a cross-origin iframe. The parent site cannot safely inspect or hook the actual Zoho form submission, so `/join` form submits are not tracked unless Zoho is configured to redirect back to a same-origin thank-you page or emit a controlled callback.

## Manual GTM / GA4 Setup

In GTM, configure GA4 tags/triggers to consume these `dataLayer` events and route reporting by hostname:

```text
stretchtherapy.sitetarik.com
```

In GA4, create or use the comparison/filter:

```text
Hostname - stretchtherapy.sitetarik.com
```
