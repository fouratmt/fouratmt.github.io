(() => {
    "use strict";

    const AAD = new TextEncoder().encode("fourat.dev:protected-page:v1");
    const body = document.body;
    const gate = document.querySelector("#password-gate");
    const form = document.querySelector("#password-gate-form");
    const password = document.querySelector("#protected-page-password");
    const status = document.querySelector("#password-gate-status");
    const payloadUrl = body.dataset.protectedPagePayload;

    if (!gate || !form || !password || !status || !payloadUrl) return;

    function decodeBase64(value) {
        const binary = atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }

    async function deriveKey(submittedPassword, salt, iterations) {
        const material = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(submittedPassword),
            "PBKDF2",
            false,
            ["deriveKey"],
        );
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"],
        );
    }

    async function decrypt(submittedPassword) {
        const response = await fetch(payloadUrl, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`Payload request failed with ${response.status}`);
        const payload = await response.json();
        if (
            payload.version !== 1 ||
            payload.kdf !== "PBKDF2-SHA256" ||
            payload.cipher !== "AES-256-GCM" ||
            !Number.isInteger(payload.iterations) ||
            payload.iterations < 100000
        ) throw new Error("Unsupported encrypted payload");

        const key = await deriveKey(submittedPassword, decodeBase64(payload.salt), payload.iterations);
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: decodeBase64(payload.iv), additionalData: AAD, tagLength: 128 },
            key,
            decodeBase64(payload.ciphertext),
        );
        const protectedContent = JSON.parse(new TextDecoder().decode(plaintext));
        if (protectedContent.version !== 1 || typeof protectedContent.html !== "string") {
            throw new Error("Invalid decrypted content");
        }
        return protectedContent.html;
    }

    function unlock(html) {
        const article = document.querySelector(".main > .post-single");
        const footer = article?.querySelector(":scope > .post-footer");
        if (!article || !footer) throw new Error("Protected page layout is unavailable");

        const content = document.createElement("div");
        content.className = "post-content protected-page-content";
        content.innerHTML = html;
        article.insertBefore(content, footer);
        password.value = "";
        gate.hidden = true;
        body.classList.remove("page-locked");
        content.setAttribute("tabindex", "-1");
        content.focus();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.textContent = gate.dataset.loading;
        const button = form.querySelector("button[type='submit']");
        button.disabled = true;

        try {
            if (!crypto.subtle) throw new Error("Web Crypto unavailable");
            unlock(await decrypt(password.value));
        } catch (error) {
            status.textContent = error instanceof DOMException && error.name === "OperationError"
                ? gate.dataset.invalidPassword
                : gate.dataset.unavailable;
            password.select();
        } finally {
            button.disabled = false;
        }
    });
})();
