# Response security headers

The public `fourat.dev` website is built and deployed by GitHub Actions to GitHub Pages. The Docker image and its NGINX server are local development and production-like preview tools only; they are not part of the public deployment path.

The local NGINX preview applies the headers in `docker/nginx.conf`. GitHub Pages does not use that configuration. If the custom domain is proxied through Cloudflare, equivalent production response headers must be configured with Cloudflare Response Header Transform Rules rather than in the Docker image or Hugo HTML.

Configure a Cloudflare Response Header Transform Rule for all paths with:

- `Content-Security-Policy`: `default-src 'self'; img-src 'self' https: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`
- `Permissions-Policy`: `camera=(), geolocation=(), microphone=(), browsing-topics=()`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `SAMEORIGIN`

The same-origin framing allowance is intentional: the English and French CV pages embed their corresponding PDFs from `fourat.dev`. Cross-origin framing remains blocked.

After deployment, verify with:

```bash
curl -I https://fourat.dev/
curl -I https://fourat.dev/resume_en.pdf
```

The policy retains `'unsafe-inline'` because PaperMod's theme initialization and fallback styles are inline. Removing it safely requires converting all remaining inline theme code to external fingerprinted resources or maintaining explicit CSP hashes.
