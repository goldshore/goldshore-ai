# GoldShore Access branding

Cloudflare applies the standard Access login page globally to all Access
applications. Configure it in **Zero Trust > Reusable components > Custom
pages > Access login page** with:

- Organization name: `Gold Shore Labs`
- Logo: `https://goldshore.ai/gsl-logo.svg`
- Background: `#06060a`
- Header: `Secure access to GoldShore operator systems`
- Footer: `Gold Shore Labs · New York · ops@goldshore.ai`

The standard login page does not accept arbitrary CSS. The values above use
the supported logo, text, and background controls. The repository's
`access-pages/identity-denied.html` provides the full GoldShore visual system
for an identity-failure block page on plans that support custom templates.

After uploading the template, attach it to the GoldShore admin, gateway, ops,
trading, and preview Access applications. Keep the default Cloudflare page as
the fallback until the custom page has been previewed at mobile and desktop
sizes.
