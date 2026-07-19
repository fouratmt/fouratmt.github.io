#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content");
const PAYLOAD_ROOT = path.join(ROOT, "static", "protected-pages");
const DEFAULT_PASSWORD_FILE = path.join(ROOT, ".protected-pages-password");
const ITERATIONS = 600_000;
const AAD = Buffer.from("fourat.dev:protected-page:v1", "utf8");

function fail(message) {
  console.error(`Protected page error: ${message}`);
  process.exitCode = 2;
}

function stripOneTrailingNewline(value) {
  return value.replace(/\r?\n$/, "");
}

async function pathExists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadPassword(variable = "PROTECTED_PAGE_PASSWORD") {
  let password = process.env[variable];
  if (password === undefined) {
    const configuredFile = process.env[`${variable}_FILE`];
    const passwordFile = configuredFile ? path.resolve(configuredFile) : DEFAULT_PASSWORD_FILE;
    if (await pathExists(passwordFile)) password = stripOneTrailingNewline(await readFile(passwordFile, "utf8"));
  }
  if (!password) throw new Error(`set ${variable}, ${variable}_FILE, or create ${path.relative(ROOT, DEFAULT_PASSWORD_FILE)}`);
  if (password.length < 16) throw new Error(`${variable} must contain at least 16 characters`);
  return password;
}

function parsePage(source, filename) {
  const lines = source.split(/(?<=\n)/);
  const opening = lines[0]?.trim();
  if (opening !== "+++" && opening !== "---") throw new Error(`${filename} must start with TOML (+++) or YAML (---) front matter`);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === opening);
  if (closingIndex < 0) throw new Error(`${filename} has unterminated front matter`);
  return {
    delimiter: opening,
    frontMatter: lines.slice(1, closingIndex).join("").replace(/\n$/, ""),
    body: lines.slice(closingIndex + 1).join("").replace(/^\r?\n/, ""),
  };
}

function readField(page, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = page.delimiter === "+++"
    ? new RegExp(`^${escaped}\\s*=\\s*[\"']([^\"']*)[\"']\\s*$`, "m")
    : new RegExp(`^${escaped}\\s*:\\s*[\"']?([^\"'\\n#]+)[\"']?\\s*(?:#.*)?$`, "m");
  return page.frontMatter.match(expression)?.[1]?.trim();
}

function isProtected(page) {
  return page.delimiter === "+++"
    ? /^passwordProtected\s*=\s*true\s*$/m.test(page.frontMatter)
    : /^passwordProtected\s*:\s*true\s*(?:#.*)?$/m.test(page.frontMatter);
}

function setStringField(page, name, value) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const serialized = page.delimiter === "+++" ? `${name} = ${JSON.stringify(value)}` : `${name}: ${JSON.stringify(value)}`;
  const expression = page.delimiter === "+++"
    ? new RegExp(`^${escaped}\\s*=.*$`, "m")
    : new RegExp(`^${escaped}\\s*:.*$`, "m");
  page.frontMatter = expression.test(page.frontMatter)
    ? page.frontMatter.replace(expression, serialized)
    : `${page.frontMatter.replace(/\s+$/, "")}\n${serialized}`;
}

function setBooleanField(page, name, value) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const serialized = page.delimiter === "+++" ? `${name} = ${value}` : `${name}: ${value}`;
  const expression = page.delimiter === "+++"
    ? new RegExp(`^${escaped}\\s*=.*$`, "m")
    : new RegExp(`^${escaped}\\s*:.*$`, "m");
  page.frontMatter = expression.test(page.frontMatter)
    ? page.frontMatter.replace(expression, serialized)
    : `${page.frontMatter.replace(/\s+$/, "")}\n${serialized}`;
}

function serializePage(page, body = "") {
  return `${page.delimiter}\n${page.frontMatter.trim()}\n${page.delimiter}\n${body ? `\n${body.replace(/\s+$/, "")}\n` : ""}`;
}

function resolveContentPage(value) {
  if (!value) throw new Error("provide a Markdown page path, for example content/en/private.md");
  const resolved = path.resolve(ROOT, value);
  if (!resolved.startsWith(`${CONTENT_ROOT}${path.sep}`) || !/\.md$/i.test(resolved)) {
    throw new Error("the page must be a Markdown file below content/");
  }
  return resolved;
}

function payloadLocation(pagePath) {
  const relative = path.relative(CONTENT_ROOT, pagePath).replaceAll(path.sep, "/");
  const identifier = createHash("sha256").update(relative).digest("hex").slice(0, 24);
  return {
    file: path.join(PAYLOAD_ROOT, `${identifier}.json`),
    url: `/protected-pages/${identifier}.json`,
  };
}

function encode(value) {
  return Buffer.from(value).toString("base64");
}

function decode(value) {
  return Buffer.from(value, "base64");
}

function encryptContent(password, markdown, html) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const plaintext = Buffer.from(JSON.stringify({ version: 1, markdown, html }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-256-GCM",
    iterations: ITERATIONS,
    salt: encode(salt),
    iv: encode(iv),
    ciphertext: encode(ciphertext),
  };
}

function validateEnvelope(payload, filename = "payload") {
  const expectedKeys = ["cipher", "ciphertext", "iterations", "iv", "kdf", "salt", "version"];
  if (
    !payload ||
    JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(expectedKeys) ||
    payload?.version !== 1 ||
    payload?.kdf !== "PBKDF2-SHA256" ||
    payload?.cipher !== "AES-256-GCM" ||
    !Number.isInteger(payload?.iterations) ||
    payload.iterations < 100_000 ||
    decode(payload?.salt ?? "").length < 16 ||
    decode(payload?.iv ?? "").length !== 12 ||
    decode(payload?.ciphertext ?? "").length <= 16
  ) throw new Error(`${filename} is not a supported encrypted payload`);
}

function decryptContent(password, payload) {
  validateEnvelope(payload);
  const salt = decode(payload.salt);
  const iv = decode(payload.iv);
  const encrypted = decode(payload.ciphertext);
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const key = pbkdf2Sync(password, salt, payload.iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const content = JSON.parse(plaintext);
  if (content?.version !== 1 || typeof content.markdown !== "string" || typeof content.html !== "string") {
    throw new Error("the decrypted payload has an invalid content format");
  }
  return content;
}

async function atomicWrite(filename, contents, mode) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode });
  await rename(temporary, filename);
  if (mode) await chmod(filename, mode);
}

async function renderMarkdown(markdown) {
  const temporary = await mkdtemp(path.join(tmpdir(), "fourat-protected-render-"));
  try {
    await mkdir(path.join(temporary, "content"), { recursive: true });
    await mkdir(path.join(temporary, "layouts", "_default"), { recursive: true });
    await writeFile(path.join(temporary, "hugo.toml"), 'baseURL = "https://fourat.dev/"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404"]\n');
    await writeFile(path.join(temporary, "content", "page.md"), `+++\ntitle = "Protected render"\n+++\n\n${markdown.replace(/\s+$/, "")}\n`);
    await writeFile(
      path.join(temporary, "layouts", "_default", "single.html"),
      '{{ .Content | jsonify }}\n',
    );
    const result = spawnSync(process.env.HUGO || "hugo", ["--source", temporary, "--destination", path.join(temporary, "public")], {
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const diagnostics = [result.stderr, result.stdout]
        .map((output) => output?.trim())
        .filter(Boolean)
        .join("\n");
      throw new Error(`Hugo could not render the protected content (exit ${result.status})${diagnostics ? `:\n${diagnostics}` : ""}`);
    }
    const output = await readFile(path.join(temporary, "public", "page", "index.html"), "utf8");
    const rendered = JSON.parse(output);
    if (typeof rendered !== "string") throw new Error("could not read Hugo's rendered protected content");
    return rendered.trim();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function readPayload(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function protectPage(pagePath, markdownOverride) {
  const source = await readFile(pagePath, "utf8");
  const page = parsePage(source, path.relative(ROOT, pagePath));
  if (!isProtected(page)) throw new Error(`${path.relative(ROOT, pagePath)} must set passwordProtected = true`);

  const location = payloadLocation(pagePath);
  const password = await loadPassword();
  let markdown = markdownOverride ?? page.body.trim();
  if (!markdown) {
    const configuredUrl = readField(page, "encryptedPayload");
    if (!configuredUrl || !(await pathExists(location.file))) {
      throw new Error("the page has no plaintext body and no existing encrypted payload");
    }
    markdown = decryptContent(password, await readPayload(location.file)).markdown;
  }
  const html = await renderMarkdown(markdown);
  const payload = encryptContent(password, markdown, html);
  setStringField(page, "encryptedPayload", location.url);
  setBooleanField(page, "robotsNoIndex", true);

  await atomicWrite(location.file, `${JSON.stringify(payload)}\n`, 0o644);
  await atomicWrite(pagePath, serializePage(page), 0o644);
  console.log(`Protected ${path.relative(ROOT, pagePath)} -> ${path.relative(ROOT, location.file)}`);
}

async function editPage(pagePath) {
  const source = await readFile(pagePath, "utf8");
  const page = parsePage(source, path.relative(ROOT, pagePath));
  if (!isProtected(page)) throw new Error(`${path.relative(ROOT, pagePath)} is not protected`);
  const location = payloadLocation(pagePath);
  const password = await loadPassword();
  const content = decryptContent(password, await readPayload(location.file));
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) throw new Error("set VISUAL or EDITOR before using the edit command");

  const temporary = await mkdtemp(path.join(tmpdir(), "fourat-protected-edit-"));
  const draft = path.join(temporary, path.basename(pagePath));
  let completed = false;
  try {
    await writeFile(draft, `${content.markdown.replace(/\s+$/, "")}\n`, { encoding: "utf8", mode: 0o600 });
    const shell = process.env.SHELL || "/bin/sh";
    const result = spawnSync(shell, ["-c", `${editor} \"$1\"`, "protected-page-editor", draft], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${editor} exited with status ${result.status}`);
    await protectPage(pagePath, (await readFile(draft, "utf8")).trim());
    completed = true;
  } finally {
    if (completed) {
      await rm(temporary, { recursive: true, force: true });
    } else {
      console.error(`Plaintext draft preserved for recovery: ${draft}`);
    }
  }
}

async function listMarkdown(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdown(target));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(target);
  }
  return files;
}

async function verifyPages() {
  const errors = [];
  const usedPayloads = new Set();
  for (const pagePath of await listMarkdown(CONTENT_ROOT)) {
    const relative = path.relative(ROOT, pagePath);
    const page = parsePage(await readFile(pagePath, "utf8"), relative);
    const configuredUrl = readField(page, "encryptedPayload");
    if (!isProtected(page)) {
      if (configuredUrl) errors.push(`${relative}: encryptedPayload requires passwordProtected = true`);
      continue;
    }
    if (page.body.trim()) errors.push(`${relative}: protected Markdown body must be empty after encryption`);
    if (!configuredUrl) {
      errors.push(`${relative}: missing encryptedPayload`);
      continue;
    }
    const expected = payloadLocation(pagePath);
    if (configuredUrl !== expected.url) errors.push(`${relative}: encryptedPayload must be ${expected.url}`);
    usedPayloads.add(expected.file);
    try {
      validateEnvelope(await readPayload(expected.file), path.relative(ROOT, expected.file));
    } catch (error) {
      errors.push(`${relative}: ${error.message}`);
    }
  }
  if (await pathExists(PAYLOAD_ROOT)) {
    for (const entry of await readdir(PAYLOAD_ROOT, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const filename = path.join(PAYLOAD_ROOT, entry.name);
        if (!usedPayloads.has(filename)) errors.push(`${path.relative(ROOT, filename)}: orphaned encrypted payload`);
      }
    }
  }
  if (errors.length) throw new Error(`verification failed:\n- ${errors.join("\n- ")}`);
  console.log(`Verified ${usedPayloads.size} encrypted protected-page payloads`);
}

async function initializePassword() {
  if (await pathExists(DEFAULT_PASSWORD_FILE)) {
    const details = await stat(DEFAULT_PASSWORD_FILE);
    if ((details.mode & 0o077) !== 0) await chmod(DEFAULT_PASSWORD_FILE, 0o600);
    console.log(`Using existing local password file ${path.relative(ROOT, DEFAULT_PASSWORD_FILE)}`);
    return;
  }
  await atomicWrite(DEFAULT_PASSWORD_FILE, `${randomBytes(24).toString("base64url")}\n`, 0o600);
  console.log(`Created local password file ${path.relative(ROOT, DEFAULT_PASSWORD_FILE)} (mode 0600; ignored by Git)`);
}

async function main() {
  const [command, pageArgument] = process.argv.slice(2);
  if (command === "init-password") await initializePassword();
  else if (command === "protect") await protectPage(resolveContentPage(pageArgument));
  else if (command === "edit") await editPage(resolveContentPage(pageArgument));
  else if (command === "verify") await verifyPages();
  else throw new Error("usage: protected_page.mjs <init-password|protect|edit|verify> [content/page.md]");
}

main().catch((error) => fail(error.message));
