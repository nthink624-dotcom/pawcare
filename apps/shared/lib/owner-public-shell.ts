/** Only public application files belong in this worker. Owner records never do. */
export const OWNER_PUBLIC_SHELL_HEADER = "X-PetManager-Public-Owner-Shell";
let prepared = false;
let lastAttempt = 0;

export function prepareOwnerPublicShell() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (prepared || Date.now() - lastAttempt < 60_000) return;
  if (process.env.NODE_ENV !== "production" && !new URLSearchParams(location.search).has("testOwnerShell")) return;
  lastAttempt = Date.now();
  void navigator.serviceWorker.register("/owner-shell-sw.js", { scope: "/owner", updateViaCache: "none" })
    .then(async (registration) => {
      prepared = true;
      const worker = registration.active ?? registration.installing ?? registration.waiting;
      const warm = () => worker?.postMessage({ type: "PREPARE_PUBLIC_OWNER_SHELL", path: location.pathname });
      if (worker?.state === "activated") warm();
      else worker?.addEventListener("statechange", () => { if (worker.state === "activated") warm(); });
    }).catch(() => { /* Private browsing or an unsupported WebView must retain the normal network path. */ });
}

export const OWNER_PUBLIC_SHELL_WORKER = String.raw`
"use strict";
const CACHE = "petmanager-public-owner-shell-v1";
const DOCUMENTS = new Set(["/owner", "/owner/mobile"]);
const warming = new Map();
const isAsset = url => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
const keyFor = path => new Request(new URL(path, self.location.origin).href);
const assetUrls = html => [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map(match => { try { return new URL(match[1].replace(/&amp;/g, "&"), self.location.origin); } catch { return null; } })
  .filter(url => url && isAsset(url)).map(url => url.href))];
async function warmDocument(path) {
  if (!DOCUMENTS.has(path)) return;
  if (warming.has(path)) return warming.get(path);
  const pending = (async () => {
    const response = await fetch(new URL(path, self.location.origin).href, {
      credentials: "omit", redirect: "error", cache: "no-store", headers: { Accept: "text/html" }
    });
    if (!response.ok || response.redirected || response.headers.get("X-PetManager-Public-Owner-Shell") !== "1" ||
        !response.headers.get("Content-Type")?.includes("text/html")) return;
    const html = await response.clone().text();
    const assets = assetUrls(html);
    if (!assets.length) return;
    const cache = await caches.open(CACHE);
    const previous = await cache.match(keyFor(path));
    const previousAssets = previous ? assetUrls(await previous.text()) : [];
    // Publish a generation's document only after all of its first-render files exist locally.
    await Promise.all(assets.map(async url => {
      if (await cache.match(url)) return;
      const asset = await fetch(url, { credentials: "omit", redirect: "error" });
      if (!asset.ok || asset.redirected) throw new Error("Public owner asset unavailable");
      await cache.put(url, asset);
    }));
    await cache.put(keyFor(path), response);
    // Retain both documents' current files and the replaced generation's files.
    const pinned = new Set([...assets, ...previousAssets]);
    for (const documentPath of DOCUMENTS) {
      if (documentPath === path) continue;
      const document = await cache.match(keyFor(documentPath));
      if (document) assetUrls(await document.text()).forEach(url => pinned.add(url));
    }
    const keys = await cache.keys();
    let count = keys.length;
    for (const key of keys) {
      if (count <= 384) break;
      if (isAsset(new URL(key.url)) && !pinned.has(key.url)) { await cache.delete(key); count -= 1; }
    }
  })().catch(() => {}).finally(() => warming.delete(path));
  warming.set(path, pending);
  return pending;
}
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (event.data?.type !== "PREPARE_PUBLIC_OWNER_SHELL") return;
  event.waitUntil(warmDocument(event.data.path));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // No API, Supabase, credentials, RSC payload, or customer data is cached by this worker.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1" || request.headers.get("Accept")?.includes("text/x-component")) return;
  if (request.mode === "navigate" && DOCUMENTS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(keyFor(url.pathname));
      if (cached) { event.waitUntil(warmDocument(url.pathname)); return cached; }
      const response = await fetch(request);
      event.waitUntil(warmDocument(url.pathname));
      return response;
    })());
  } else if (isAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && !response.redirected) await cache.put(request, response.clone());
      return response;
    })());
  }
});
`;
