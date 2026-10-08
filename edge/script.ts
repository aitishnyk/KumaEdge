import * as BunnySDK from "@bunny.net/edgescript-sdk";

/**
 * Public Bunny Edge Script proof of runtime and bounded outbound connectivity.
 * This is deliberately stateless: NOT a monitoring scheduler or historical DB.
 * Targets are fixed at deploy time; there is no arbitrary user-supplied URL.
 */
const TARGETS = Object.freeze([
  { id: "example", name: "Example Domain", url: "https://example.com/" }
]);
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*"
};
const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: HEADERS });

async function check(target: (typeof TARGETS)[number]) {
  const start = performance.now();
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
      headers: { "accept": "text/html,application/json;q=0.8,*/*;q=0.5" }
    });
    // Redirects are explicitly NOT followed, preventing unexpected destinations.
    return {
      id: target.id, name: target.name, url: target.url,
      up: response.status >= 200 && response.status < 400,
      status: response.status,
      durationMs: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      id: target.id, name: target.name, url: target.url,
      up: false, status: null,
      durationMs: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString(),
      error: "Request failed or timed out"
    };
  }
}

BunnySDK.net.http.serve(async (request: Request) => {
  const pathname = new URL(request.url).pathname;
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204, headers: { ...HEADERS, "access-control-allow-methods": "GET, OPTIONS" }
  });
  if (request.method !== "GET") return reply({ error: "Method not allowed" }, 405);
  if (pathname === "/health" || pathname === "/api/health") {
    return reply({ service: "kumaedge", status: "ok", runtime: "bunny-edge", timestamp: new Date().toISOString() });
  }
  if (pathname === "/api/targets") {
    return reply({ targets: TARGETS.map(({ id, name, url }) => ({ id, name, url })) });
  }
  if (pathname === "/api/check") {
    const targetId = new URL(request.url).searchParams.get("id") || "";
    const target = TARGETS.find(target => target.id === targetId);
    if (!target) return reply({ error: "Unknown configured target" }, 404);
    return reply(await check(target));
  }
  return reply({ error: "Not found" }, 404);
});
