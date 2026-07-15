#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const siteRoot = path.resolve(process.argv[2] ?? "/tmp/fourat-browser-site");
const host = "127.0.0.1";
const sitePort = Number(process.env.SITE_PORT ?? 4173);
const requestedDebugPort = Number(process.env.CHROME_DEBUG_PORT ?? 0);

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
let chromeDiagnostics = "";
const chrome = spawn(findChrome(), [
  "--headless=new",
  "--disable-extensions",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-sandbox",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${requestedDebugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", (chunk) => {
  chromeDiagnostics = `${chromeDiagnostics}${chunk}`.slice(-4000);
});

async function waitForJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited with code ${chrome.exitCode}:\n${chromeDiagnostics.trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}${chromeDiagnostics ? `:\n${chromeDiagnostics.trim()}` : ""}`);
}

async function discoverDebugPort() {
  if (requestedDebugPort) return requestedDebugPort;
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split("\n");
      if (port) return Number(port);
    } catch {}
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited with code ${chrome.exitCode}:\n${chromeDiagnostics.trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome did not publish its debugging port${chromeDiagnostics ? `:\n${chromeDiagnostics.trim()}` : ""}`);
}

let socket;
try {
  const debugPort = await discoverDebugPort();
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
    ["/", "en-US", "/fr/", "index, follow", 375, 812],
    ["/fr/cv/", "fr-FR", "/cv/", "index, follow", 375, 812],
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
        const pdf = document.querySelector('.pdf-reader object');
        return {
          lang: document.documentElement.lang,
          title: document.title,
          robots: robotValues.at(-1),
          translation: languageLink ? new URL(languageLink.href).pathname : null,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          themeLabel: document.querySelector('#theme-toggle')?.getAttribute('aria-label'),
          pdfHidden: pdf ? getComputedStyle(pdf).display === 'none' : null,
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
    if (result.overflow) failures.push(`${label}: horizontal overflow`);
    if (!result.themeLabel) failures.push(`${label}: theme toggle missing accessible label`);
    if (width < 600 && route.includes("cv") && result.pdfHidden !== true) failures.push(`${label}: PDF embed visible on mobile`);
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
