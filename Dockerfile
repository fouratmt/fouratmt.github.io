# syntax=docker/dockerfile:1.7
# Local production-like preview image. The public site is deployed to GitHub Pages.
FROM ghcr.io/gohugoio/hugo:v0.164.0 AS build

WORKDIR /project
COPY . .
RUN hugo --gc --minify --panicOnWarning --environment production --destination /tmp/public

FROM nginxinc/nginx-unprivileged:1.31.3-alpine

USER root
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /tmp/public /usr/share/nginx/html
USER nginx

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/ || exit 1
