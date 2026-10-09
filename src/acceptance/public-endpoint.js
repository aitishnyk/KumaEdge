/**
 * Non-authenticated acceptance. Never sends passwords, cookies or API tokens.
 * A passing result is only a narrow transport/cache check, not proof of security.
 */
export function parseEndpoint(url, {allowLocalHttp=false}={}) {
  const endpoint = new URL(url);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("URL must not contain user info, query or fragment");
  }
  const local = ["127.0.0.1","localhost","[::1]"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !(allowLocalHttp && local && endpoint.protocol === "http:")) {
    throw new Error("HTTPS is required for production checks");
  }
  return endpoint.origin;
}

export function reviewCacheHeaders(headers) {
  const cc = (headers.get("cache-control") || "").toLowerCase();
  const age = Number(headers.get("age") || "0");
  const cacheSignals = ["x-cache","cf-cache-status","cdn-cache","x-cache-status","x-bunny-cache"];
  const hits = cacheSignals.filter(h => /\bhit\b/i.test(headers.get(h) || ""));
  const unsafeDirective = /\b(public|s-maxage)\b/.test(cc) || /\bmax-age\s*=\s*[1-9]/.test(cc);
  const explicitlyPrivate = /\b(no-store|private)\b/.test(cc);
  return {
    safe: explicitlyPrivate && !unsafeDirective && !(age>0) && hits.length===0,
    cacheControl: cc || null,
    age: Number.isFinite(age)?age:null,
    cacheHits: hits
  };
}

export function isEngineIOHandshake(status, body) {
  if(status!==200 || !body.startsWith("0{")) return false;
  try {
    const msg=JSON.parse(body.slice(1));
    return typeof msg.sid==="string" && msg.sid.length>0
      && Number.isFinite(msg.pingInterval) && Number.isFinite(msg.pingTimeout);
  } catch { return false; }
}

export async function auditEndpoint(url,{allowLocalHttp=false,mode="production",fetchImpl=fetch}={}) {
  if(!["production","smoke"].includes(mode)) throw new TypeError("Invalid mode");
  const origin=parseEndpoint(url,{allowLocalHttp});
  const request=async path=>{
    const response=await fetchImpl(origin+path,{
      method:"GET",
      redirect:"manual",
      cache:"no-store",
      headers:{"accept":"text/html,application/json"},
      signal:AbortSignal.timeout(8000)
    });
    return response;
  };
  let page=await request("/");
  // Follow only same-origin, local HTTP redirects. Avoid credential leaks.
  for(let i=0;i<3&&[301,302,303,307,308].includes(page.status);i++){
    const location=page.headers.get("location");
    if(!location) throw new Error("Redirect without Location");
    const next=new URL(location,origin);
    if(next.origin!==origin)throw new Error("Cross-origin redirect refused");
    page=await request(next.pathname+next.search);
  }
  if(page.status!==200)throw new Error("Landing page is not HTTP 200: "+page.status);
  const cache=reviewCacheHeaders(page.headers);
  if(mode==="production"&&!cache.safe)throw new Error("Unsafe or unverified cache headers; do not expose admin login");
  const socket=await request("/socket.io/?EIO=4&transport=polling");
  const bytes=(await socket.text()).slice(0,4096);
  if(!isEngineIOHandshake(socket.status,bytes)) throw new Error("Engine.IO polling handshake failed");
  return {pass:true,origin,mode,cache,engineIO:"pass",httpStatus:page.status};
}
