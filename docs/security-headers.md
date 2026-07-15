# Production security headers

The Docker image applies the headers in `docker/nginx.conf` directly at the HTTP layer. The public `fourat.dev` deployment uses GitHub Pages behind Cloudflare, so equivalent response headers must be configured in Cloudflare rather than in Hugo HTML.

Configure a Cloudflare Response Header Transform Rule for all paths with:

- `Content-Security-Policy`: `default-src 'self'; img-src 'self' https: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- `Permissions-Policy`: `camera=(), geolocation=(), microphone=(), browsing-topics=()`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`

After deployment, verify with:

```bash
curl -I https://fourat.dev/
```

The policy retains `'unsafe-inline'` because PaperMod's theme initialization and fallback styles are inline. Removing it safely requires converting all remaining inline theme code to external fingerprinted resources or maintaining explicit CSP hashes.
