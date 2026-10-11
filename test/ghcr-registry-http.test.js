import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ghcrRootDigest } from "../scripts/ghcr-registry-http.mjs";

const ref = "ghcr.io/aitishnyk/kumaedge:" + "f".repeat(40);
const media = "application/vnd.oci.image.index.v1+json";
const body = JSON.stringify({ schemaVersion:2, mediaType:media, manifests:[] });
const digest = "sha256:" + createHash("sha256").update(body).digest("hex");

function mockRegistry({ privateOnly=false, badHeader=false, missingHeader=false, overrideHeaders={} }={}) {
  const calls = [];
  async function request(url, options) {
    const u = new URL(url);
    calls.push({url:u.toString(),options});
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error", "redirects could expose registry bearer headers");
    assert.equal(u.hostname, "ghcr.io", "do not send secrets to third parties");
    if (u.pathname === "/token") {
      assert.equal(u.searchParams.get("service"), "ghcr.io");
      assert.equal(u.searchParams.get("scope"), "repository:aitishnyk/kumaedge:pull");
      const authenticated = Boolean(options.headers.Authorization);
      return new Response(JSON.stringify({token:authenticated ? "priv" : "anon"}), {
        status:200, headers:{"content-type":"application/json"}
      });
    }
    assert.match(u.pathname,/^\/v2\/aitishnyk\/kumaedge\/manifests\/f{40}$/);
    if (privateOnly && options.headers.Authorization === "Bearer anon") {
      return new Response("",{status:401});
    }
    const headers = {"content-type":media};
    if (!missingHeader) headers["docker-content-digest"] = badHeader
      ? "sha256:" + "e".repeat(64) : digest;
    return new Response(body,{status:200,headers:{...headers,...overrideHeaders}});
  }
  return {request,calls};
}

test("anonymous GHCR root digest checks SHA256 of raw bytes without exposing GitHub token",async()=>{
  const {request,calls}=mockRegistry();
  assert.equal(await ghcrRootDigest(ref,{request,username:"owner",credential:"FAKE_TEST_SECRET"}),digest);
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(calls[1].options.headers.Authorization,"Bearer anon");
});

test("private GHCR only retries with Basic credentials on fixed HTTPS token endpoint",async()=>{
  const {request,calls}=mockRegistry({privateOnly:true});
  assert.equal(await ghcrRootDigest(ref,{request,username:"owner",credential:"FAKE_TEST_SECRET"}),digest);
  assert.equal(calls.length,4);
  assert.equal(new URL(calls[2].url).pathname,"/token");
  assert.equal(calls[2].options.headers.Authorization,
    "Basic " + Buffer.from("owner:FAKE_TEST_SECRET").toString("base64"));
  assert.equal(calls[3].options.headers.Authorization,"Bearer priv");
});

test("private package with no GitHub read:packages credential fails closed",async()=>{
  const {request}=mockRegistry({privateOnly:true});
  await assert.rejects(ghcrRootDigest(ref,{request,username:"",credential:""}),/read:packages/);
});

test("GHCR rejects missing or falsified root digest header",async()=>{
  for(const config of [{badHeader:true},{missingHeader:true}]){
    const {request}=mockRegistry(config);
    await assert.rejects(ghcrRootDigest(ref,{request}),/digest/i);
  }
});

test("GHCR reference validation refuses unsupported URLs and non-immutable tags before requests",async()=>{
  for(const invalid of [
    "https://"+ref,"ghcr.io/other/image:latest","ghcr.io/other/image:"+"a".repeat(39)
  ]){
    await assert.rejects(ghcrRootDigest(invalid,{
      request:()=>{throw Error("No request must be sent for invalid reference");}
    }),/GHCR SHA-tagged/);
  }
});

test("unknown manifest media type, oversized response and redirect fail closed",async()=>{
  for(const overrideHeaders of [
    {"content-type":"text/html"},{"content-length":"999999999"}
  ]){
    const {request}=mockRegistry({overrideHeaders});
    await assert.rejects(ghcrRootDigest(ref,{request}),/manifest|content/i);
  }
  await assert.rejects(ghcrRootDigest(ref,{
    request:async()=>new Response("",{status:302,headers:{location:"https://evil.example"}})
  }),/token request denied/);
});

test("registry authentication errors do not disclose credential in exception",async()=>{
  const token="FAKE_TEST_NEVER_LOG_THIS_TOKEN";
  const {request}=mockRegistry({privateOnly:true});
  const rejectPrivate=async(url,opts)=>{
    if(new URL(url).pathname==="/token" && opts.headers.Authorization) {
      return new Response("Denied",{status:403});
    }
    return request(url,opts);
  };
  await assert.rejects(ghcrRootDigest(ref,{request:rejectPrivate,username:"owner",credential:token}),
    err => err instanceof Error && !err.message.includes(token) && /HTTP 403/.test(err.message));
});

test("403 for both anonymous and authenticated pulls reports visibility/permission, not digest mismatch",async()=>{
  const never="DO_NOT_EXPOSE_TEST_READ_PACKAGES_TOKEN";
  const opts=[];
  async function denyManifest(url, options) {
    opts.push({url,headers:options.headers});
    if(new URL(url).pathname==="/token") {
      return new Response(JSON.stringify({token:"opaque-bearer"}),{status:200});
    }
    return new Response("",{status:403});
  }
  await assert.rejects(
    ghcrRootDigest(ref,{request:denyManifest,username:"owner",credential:never}),
    error=>error instanceof Error &&
      /read:packages authorization/.test(error.message) &&
      /NOT an OCI digest mismatch/.test(error.message) &&
      /HTTP 403/.test(error.message) &&
      !error.message.includes(never)
  );
  assert.equal(opts.length,4);
  assert.equal(opts[2].headers.Authorization,
    "Basic "+Buffer.from("owner:"+never).toString("base64"));
});

test("a separate read-only GHCR PAT can be configured without changing GitHub API auth",async()=>{
  const {request}=mockRegistry({privateOnly:true});
  const previous=process.env.GHCR_READ_TOKEN;
  try {
    process.env.GHCR_READ_TOKEN="ONLY_FOR_TEST_READ_PACKAGES";
    const guarded=async(url,options)=>{
      if(new URL(url).pathname==="/token" && options.headers.Authorization) {
        assert.equal(options.headers.Authorization,
          "Basic "+Buffer.from("owner:ONLY_FOR_TEST_READ_PACKAGES").toString("base64"));
      }
      return request(url,options);
    };
    assert.equal(await ghcrRootDigest(ref,{request:guarded,username:"owner"}),digest);
  }finally{
    if(previous===undefined)delete process.env.GHCR_READ_TOKEN;
    else process.env.GHCR_READ_TOKEN=previous;
  }
});
