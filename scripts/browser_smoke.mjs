#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const siteRoot = path.resolve(process.argv[2] ?? "/tmp/fourat-browser-site");
const host = "127.0.0.1";
const sitePort = Number(process.env.SITE_PORT ?? 4173);
const protectedFixturePassword = randomBytes(24).toString("base64url");

async function installProtectedPageFixture() {
  const page = await readFile(path.join(siteRoot, "my-links", "index.html"), "utf8");
  const payloadMatch = page.match(/data-protected-page-payload=(?:"([^"]+)"|([^\s>]+))/);
  const payloadUrl = payloadMatch?.[1] || payloadMatch?.[2];
  if (!payloadUrl) throw new Error("Protected browser-test page does not reference an encrypted payload");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(protectedFixturePassword, salt, 100_000, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("fourat.dev:protected-page:v1", "utf8"));
  const cleartext = Buffer.from(JSON.stringify({
    version: 1,
    markdown: "Browser-only encrypted fixture.",
    html: '<p id="protected-browser-fixture">Browser-only encrypted fixture.</p>',
  }));
  const ciphertext = Buffer.concat([cipher.update(cleartext), cipher.final(), cipher.getAuthTag()]);
  const payload = {
    version: 1,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-256-GCM",
    iterations: 100_000,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  await writeFile(path.join(siteRoot, payloadUrl.replace(/^\//, "")), `${JSON.stringify(payload)}\n`);
}

await installProtectedPageFixture();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const chrome = candidates.find((candidate) => existsSync(candidate));
  if (!chrome) throw new Error("Chrome or Chromium was not found; set CHROME_BIN");
  return chrome;
}

async function findAvailablePort() {
  if (process.env.CHROME_DEBUG_PORT) {
    const port = Number(process.env.CHROME_DEBUG_PORT);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
    throw new Error("CHROME_DEBUG_PORT must be an integer between 1 and 65535");
  }

  const portServer = createNetServer();
  await new Promise((resolve, reject) => {
    portServer.once("error", reject);
    portServer.listen(0, host, resolve);
  });
  const address = portServer.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not allocate a Chrome debugging port");
  return port;
}

function staticTarget(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}`).pathname);
  let target = path.resolve(siteRoot, `.${pathname}`);
  if (!target.startsWith(`${siteRoot}${path.sep}`) && target !== siteRoot) return null;
  if (pathname.endsWith("/")) target = path.join(target, "index.html");
  else if (!path.extname(target) && existsSync(path.join(target, "index.html"))) target = path.join(target, "index.html");
  return existsSync(target) ? target : null;
}

const server = createServer((request, response) => {
  const target = staticTarget(request.url ?? "/");
  if (!target) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mimeTypes[path.extname(target)] ?? "application/octet-stream" });
  createReadStream(target).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(sitePort, host, resolve);
});

const profile = await mkdtemp(path.join(tmpdir(), "fourat-chrome-"));
const debugPort = await findAvailablePort();
let chromeDiagnostics = "";
const chrome = spawn(findChrome(), [
  "--headless=new",
  "--disable-extensions",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-sandbox",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", (chunk) => {
  chromeDiagnostics = `${chromeDiagnostics}${chunk}`.slice(-4000);
});

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited with code ${chrome.exitCode}:\n${chromeDiagnostics.trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${url}${chromeDiagnostics ? `:\n${chromeDiagnostics.trim()}` : ""}`);
}

let socket;
try {
  const targets = await waitForJson(`http://${host}:${debugPort}/json/list`);
  const target = targets.find((candidate) => candidate.type === "page");
  if (!target) throw new Error("Chrome did not expose a page target");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  let badResponses = [];
  let runtimeErrors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
      badResponses.push(`${message.params.response.status} ${message.params.response.url}`);
    } else if (message.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(message.params.exceptionDetails.text);
    }
  });

  function cdp(method, params = {}) {
    commandId += 1;
    return new Promise((resolve, reject) => {
      pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
  }

  await cdp("Page.enable");
  await cdp("Network.enable");
  await cdp("Runtime.enable");

  const checks = [
    ["/", "en-US", "/fr/", "index, follow", 1440, 900],
    ["/about/", "en-US", "/fr/about/", "index, follow", 1440, 900],
    ["/cv/", "en-US", "/fr/cv/", "index, follow", 1440, 900],
    ["/privacy/", "en-US", "/fr/privacy/", "noindex, follow", 1440, 900],
    ["/fr/", "fr-FR", "/", "index, follow", 1440, 900],
    ["/fr/about/", "fr-FR", "/about/", "index, follow", 1440, 900],
    ["/fr/cv/", "fr-FR", "/cv/", "index, follow", 1440, 900],
    ["/fr/privacy/", "fr-FR", "/privacy/", "noindex, follow", 1440, 900],
    ["/my-links/", "en-US", "/fr/my-links/", "noindex, nofollow, noarchive, nosnippet, noimageindex", 1440, 900],
    ["/", "en-US", "/fr/", "index, follow", 375, 812],
    ["/fr/cv/", "fr-FR", "/cv/", "index, follow", 375, 812],
    ["/fr/my-links/", "fr-FR", "/my-links/", "noindex, nofollow, noarchive, nosnippet, noimageindex", 375, 812],
  ];

  const failures = [];
  for (const [route, language, translation, robots, width, height] of checks) {
    badResponses = [];
    runtimeErrors = [];
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp("Page.navigate", { url: `http://${host}:${sitePort}${route}` });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const state = await cdp("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
      if (state.result.value === "complete") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const evaluated = await cdp("Runtime.evaluate", {
      expression: `(() => {
        const robotValues = [...document.querySelectorAll('meta[name="robots"]')].map((meta) => meta.content);
        const languageLink = document.querySelector('.lang-switch a');
        const languageSeparator = document.querySelector('.lang-switch-separator');
        const pdf = document.querySelector('.pdf-reader object');
        const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')];
        return {
          lang: document.documentElement.lang,
          title: document.title,
          robots: robotValues.at(-1),
          translation: languageLink ? new URL(languageLink.href).pathname : null,
          languageSeparator: languageSeparator?.textContent.trim(),
          languageSeparatorHidden: languageSeparator?.getAttribute('aria-hidden'),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          themeLabel: document.querySelector('#theme-toggle')?.getAttribute('aria-label'),
          pdfHidden: pdf ? getComputedStyle(pdf).display === 'none' : null,
          schemaCount: schemas.length,
          schemaValid: schemas.every((schema) => { try { JSON.parse(schema.textContent); return true; } catch { return false; } }),
          schemaVisible: document.body.innerText.includes('"@context":"https://schema.org"'),
          profileButtons: [...document.querySelectorAll('.profile .buttons .button')].map((button) => button.textContent.trim()),
          pageLocked: document.body.classList.contains('page-locked'),
          gateVisible: document.querySelector('#password-gate') ? getComputedStyle(document.querySelector('#password-gate')).display !== 'none' : false,
          protectedBodyVisible: document.querySelector('.main > .post-single') ? getComputedStyle(document.querySelector('.main > .post-single')).display !== 'none' : null,
          headerVisible: getComputedStyle(document.querySelector('.header')).display !== 'none',
        };
      })()`,
      returnByValue: true,
    });
    const result = evaluated.result.value;
    const label = `${route} at ${width}x${height}`;
    if (result.lang !== language) failures.push(`${label}: lang=${result.lang}`);
    if (!result.title) failures.push(`${label}: missing title`);
    if (result.robots !== robots) failures.push(`${label}: robots=${result.robots}`);
    if (result.translation !== translation) failures.push(`${label}: translation=${result.translation}`);
    if (result.languageSeparator !== "|" || result.languageSeparatorHidden !== "true") failures.push(`${label}: language separator missing or exposed to assistive technology`);
    if (result.overflow) failures.push(`${label}: horizontal overflow`);
    if (!result.themeLabel) failures.push(`${label}: theme toggle missing accessible label`);
    if (width < 600 && route.includes("cv") && result.pdfHidden !== true) failures.push(`${label}: PDF embed visible on mobile`);
    if (!result.schemaCount) failures.push(`${label}: missing JSON-LD structured data`);
    if (!result.schemaValid) failures.push(`${label}: invalid JSON-LD structured data`);
    if (result.schemaVisible) failures.push(`${label}: JSON-LD visible in page content`);
    if ((route === "/" || route === "/fr/") && (!result.profileButtons.some((label) => label.includes("📧")) || !result.profileButtons.some((label) => label.includes("📝")))) failures.push(`${label}: profile button icons missing`);
    const protectedRoute = route.includes("my-links");
    if (protectedRoute && (!result.pageLocked || !result.gateVisible || result.protectedBodyVisible || !result.headerVisible)) failures.push(`${label}: encrypted page is not initially locked`);
    if (!protectedRoute && result.pageLocked) failures.push(`${label}: public page is unexpectedly locked`);

    if (route === "/my-links/") {
      await cdp("Runtime.evaluate", {
        expression: `(() => {
          document.querySelector('#protected-page-password').value = 'definitely-wrong-password';
          document.querySelector('#password-gate-form').requestSubmit();
        })()`,
      });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const state = await cdp("Runtime.evaluate", {
          expression: "document.querySelector('#password-gate-status').textContent",
          returnByValue: true,
        });
        if (state.result.value === "Incorrect password.") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const rejected = await cdp("Runtime.evaluate", {
        expression: `({
          status: document.querySelector('#password-gate-status').textContent,
          locked: document.body.classList.contains('page-locked')
        })`,
        returnByValue: true,
      });
      if (rejected.result.value.status !== "Incorrect password." || !rejected.result.value.locked) {
        failures.push(`${label}: incorrect password was not rejected`);
      }

      await cdp("Runtime.evaluate", {
        expression: `(() => {
          document.querySelector('#protected-page-password').value = ${JSON.stringify(protectedFixturePassword)};
          document.querySelector('#password-gate-form').requestSubmit();
        })()`,
      });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const state = await cdp("Runtime.evaluate", {
          expression: "document.body.classList.contains('page-locked')",
          returnByValue: true,
        });
        if (state.result.value === false) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const unlocked = await cdp("Runtime.evaluate", {
        expression: `({
          locked: document.body.classList.contains('page-locked'),
          gateVisible: getComputedStyle(document.querySelector('#password-gate')).display !== 'none',
          fixture: document.querySelector('#protected-browser-fixture')?.textContent,
          articleVisible: getComputedStyle(document.querySelector('.main > .post-single')).display !== 'none'
        })`,
        returnByValue: true,
      });
      if (unlocked.result.value.locked || unlocked.result.value.gateVisible || !unlocked.result.value.articleVisible || unlocked.result.value.fixture !== "Browser-only encrypted fixture.") {
        failures.push(`${label}: correct password did not reveal decrypted content`);
      }
    }
    failures.push(...badResponses.map((failure) => `${label}: ${failure}`));
    failures.push(...runtimeErrors.map((failure) => `${label}: runtime error: ${failure}`));
  }

  if (failures.length) throw new Error(`Browser smoke checks failed:\n- ${failures.join("\n- ")}`);
  console.log(`Browser smoke checks passed for ${checks.length} route/viewport combinations`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  chrome.kill("SIGTERM");
  server.close();
}
