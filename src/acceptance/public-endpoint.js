/**
 * Read-only, unauthenticated public endpoint acceptance.
 * No passwords, API tokens, cookies, or mutable requests are transmitted.
 * Passing these gates is NOT equivalent to a full production security audit.
 */
const maxResponseBytes = 8192;
const timeoutMs = 8000;
const redirectCodes = new Set([301, 302, 303, 307, 308]);

export function parseEndpoint(url, { allowLocalHttp = false } = {}) {
  const endpoint = new URL(url);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("URL must not contain user info, query or fragment");
  }
  if (endpoint.pathname !== "/") throw new Error("Use the origin URL without a subpath");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !(allowLocalHttp && local && endpoint.protocol === "http:")) {
    throw new Error("HTTPS is required for production checks");
  }
  return endpoint.origin;
}

export function reviewCacheHeaders(headers) {
  const cc = (headers.get("cache-control") || "").toLowerCase();
  const age = Number(headers.get("age") || "0");
  const names = ["x-cache", "cf-cache-status", "cdn-cache", "x-cache-status", "x-bunny-cache"];
  const cacheHits = names.filter((h) => /\bhit\b/i.test(headers.get(h) || ""));
  const unsafe = /\b(public|s-maxage)\b/.test(cc) || /\bmax-age\s*=\s*[1-9]/.test(cc);
  const protectedByPolicy = /\b(no-store|private)\b/.test(cc);
  return {
    safe: protectedByPolicy && !unsafe && Number.isFinite(age) && age <= 0 && !cacheHits.length,
    cacheControl: cc || null,
    age: Number.isFinite(age) ? age : null,
    cacheHits
  };
}

export function isEngineIOHandshake(status, body) {
  if (status !== 200 || typeof body !== "string" || !body.startsWith("0{")) return false;
  try {
    const packet = JSON.parse(body.slice(1));
    return typeof packet.sid === "string" && packet.sid.length > 0
      && Number.isFinite(packet.pingInterval) && Number.isFinite(packet.pingTimeout);
  } catch { return false; }
}

export async function readBoundedText(response, limit = maxResponseBytes) {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 65536) throw new RangeError("Invalid response limit");
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > limit) throw new Error("Engine.IO response is oversized");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Engine.IO response is oversized");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const combined = new Uint8Array(bytes);
  let cursor = 0;
  for (const chunk of parts) { combined.set(chunk, cursor); cursor += chunk.byteLength; }
  return new TextDecoder().decode(combined);
}

/** Real Engine.IO websocket upgrade check; no authentication is attempted. */
export async function auditWebSocket(origin, { WebSocketImpl = globalThis.WebSocket, timeout = timeoutMs } = {}) {
  if (typeof WebSocketImpl !== "function") throw new Error("WebSocket API unavailable; run Node.js 22+");
  if (!Number.isFinite(timeout) || timeout < 10 || timeout > 30000) throw new RangeError("Invalid WebSocket timeout");
  const address = new URL("/socket.io/?EIO=4&transport=websocket", origin);
  address.protocol = address.protocol === "https:" ? "wss:" : "ws:";
  return new Promise((resolve, reject) => {
    let socket;
    let settled = false;
    let timer;
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* no-op */ }
      if (error) reject(error);
      else resolve("pass");
    };
    try {
      socket = new WebSocketImpl(address.href);
      socket.addEventListener("message", (event) => {
        const packet = typeof event.data === "string" ? event.data : "";
        if (isEngineIOHandshake(200, packet)) settle();
        else settle(new Error("Invalid Engine.IO WebSocket opening packet"));
      }, { once: true });
      socket.addEventListener("error", () => settle(new Error("Engine.IO WebSocket connection error")), { once: true });
      socket.addEventListener("close", () => settle(new Error("Engine.IO WebSocket closed before handshake")), { once: true });
      timer = setTimeout(() => settle(new Error("Engine.IO WebSocket handshake timed out")), timeout);
    } catch {
      settle(new Error("Could not initialize Engine.IO WebSocket handshake"));
    }
  });
}

export async function auditEndpoint(url, {
  allowLocalHttp = false, mode = "production", fetchImpl = fetch,
  WebSocketImpl = globalThis.WebSocket
} = {}) {
  if (!["production", "smoke"].includes(mode)) throw new TypeError("Invalid mode");
  if (mode === "production" && allowLocalHttp) throw new Error("Local HTTP is only permitted in smoke mode");
  const origin = parseEndpoint(url, { allowLocalHttp });
  const request = (path) => fetchImpl(origin + path, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: { "accept": "text/html,application/json" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  let page = await request("/");
  for (let redirects = 0; redirects < 3 && redirectCodes.has(page.status); redirects++) {
    const location = page.headers.get("location");
    if (!location) throw new Error("Redirect missing Location");
    const next = new URL(location, origin);
    if (next.origin !== origin) throw new Error("Cross-origin redirect refused");
    if (next.pathname.startsWith("/socket.io/")) throw new Error("Unexpected Socket.IO redirect");
    await page.body?.cancel().catch(() => {});
    page = await request(next.pathname + next.search);
  }
  if (page.status !== 200) throw new Error("Landing page is not HTTP 200: " + page.status);
  const cache = reviewCacheHeaders(page.headers);
  await page.body?.cancel().catch(() => {});
  if (mode === "production" && !cache.safe) throw new Error("Unsafe or unverified HTML cache policy");
  const pollingResponse = await request("/socket.io/?EIO=4&transport=polling");
  const pollingCache = reviewCacheHeaders(pollingResponse.headers);
  const bytes = await readBoundedText(pollingResponse);
  if (!isEngineIOHandshake(pollingResponse.status, bytes)) {
    throw new Error("Engine.IO polling handshake failed (HTTP " + pollingResponse.status + ")");
  }
  if (mode === "production" && !pollingCache.safe) {
    throw new Error("Unsafe or unverified Engine.IO polling cache policy");
  }
  const websocket = await auditWebSocket(origin, { WebSocketImpl });
  return { pass: true, origin, mode, cache, pollingCache, engineIO: "pass", websocket, httpStatus: page.status };
}
