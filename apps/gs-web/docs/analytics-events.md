# Homepage Analytics Events

Track homepage CTA interactions with the following event names.

## Event Catalog

| Event name | Trigger | Source route | Destination |
| --- | --- | --- | --- |
| `homepage_cta_primary_click` | Hero primary CTA click | `/` | `/contact` |
| `homepage_cta_secondary_click` | Hero secondary CTA click | `/` | `/services` |
| `homepage_cta_bottom_click` | Bottom CTA click | `/` | `/contact` |

## Required Event Properties

All homepage CTA click events should include:

- `event_name`
- `route` (expected: `/`)
- `cta_label`
- `cta_href`
- `cta_variant` (`primary`, `secondary`, or `bottom`)
- `timestamp`
# Analytics Events

The web app emits analytics events via `src/scripts/analytics.ts`.

## Event transport

Each tracked event sends:

- `window.dataLayer.push({ event, ...payload })` when `dataLayer` is present.
- `window.gtag('event', eventName, payload)` when `gtag` is present.
- `window.dispatchEvent(new CustomEvent('gs:analytics', { detail }))` for local listeners.

All event triggers are debounced. The contact form submit flow is also guarded to prevent duplicate submissions while a request is in-flight.

## Event catalog

### `homepage_cta_click`

Triggered when a homepage CTA is clicked (hero or contact CTA).

Payload:

```ts
{
  cta_id: string;      // e.g. "homepage-hero-primary-cta"
  page_path: string;   // e.g. "/"
}
```

### `services_cta_click`

Triggered when a services page CTA is clicked.

Payload:

```ts
{
  cta_id: string;      // e.g. "services-hero-cta"
  page_path: string;   // e.g. "/services"
}
```

### `contact_form_start`

Triggered once per page view on the first form interaction (`focusin` or `input`) on the contact form.

Payload:

```ts
{
  form_id: 'contact-form';
  page_path: string;   // e.g. "/contact"
}
```

### `contact_submit_success`

Triggered after a successful contact form submit response.

Payload:

```ts
{
  form_id: 'contact-form';
  page_path: string;        // e.g. "/contact"
  submission_id: string;    // UUID (or timestamp fallback)
  response_status: number;  // HTTP status
}
```

### `contact_submit_failure`

Triggered when a contact form submit request fails.

Payload:

```ts
{
  form_id: 'contact-form';
  page_path: string;      // e.g. "/contact"
  submission_id: string;  // UUID (or timestamp fallback)
}
```

### `thank_you_page_view`

Triggered once when the thank-you page is viewed.

Payload:

```ts
{
  page_path: string;    // e.g. "/thank-you"
}
```
