import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasSuccessfulMainRelease, checkMainRelease } from "../scripts/verify-release-provenance.mjs";
import { classifyManifest, planImagePublish, guardRelease } from "../scripts/guard-ghcr-publish.mjs";

const SHA = "6f6dbf98928058afcf229f3f53f8aca57d5900cd";
const eligibleRun = {
  id: 321, head_sha: SHA, head_branch: "main", event: "push",
  status: "completed", conclusion: "success"
};

test("only a successful official main push release counts, not green PR or branch CI", () => {
  assert.equal(hasSuccessfulMainRelease({workflow_runs: [eligibleRun]}, SHA), true);
  for(const mutation of [
    { event:"pull_request" }, {event:"workflow_dispatch"},
    { head_branch:"feature/foo" }, {head_sha:"a".repeat(40)},
    {status:"in_progress"}, {conclusion:"failure"}, {conclusion:null}
  ]) {
    assert.equal(hasSuccessfulMainRelease({workflow_runs:[{...eligibleRun,...mutation}]},SHA),false,
      "Unexpected accepted release: "+JSON.stringify(mutation));
  }
  assert.equal(hasSuccessfulMainRelease({workflow_runs:[eligibleRun]},"bad-sha"),false);
  assert.equal(hasSuccessfulMainRelease({workflow_runs:[]},SHA),false);
  assert.equal(hasSuccessfulMainRelease({total_count:1},SHA),false);
});

test("GitHub provenance fetch uses the correct workflow, SHA, branch and token", async () => {
  let called = 0;
  const result = await checkMainRelease(SHA,{
    repo:"aitishnyk/KumaEdge",token:"SYNTHETIC_TEST_TOKEN",
    request:async (url, options) => {
      called++;
      assert.equal(url.hostname,"api.github.com");
      assert.equal(options.headers.Authorization,"Bearer SYNTHETIC_TEST_TOKEN");
      if (url.pathname.endsWith("/runs")) {
        assert.equal(url.pathname,
          "/repos/aitishnyk/KumaEdge/actions/workflows/bunny-managed-image.yml/runs");
        assert.equal(url.searchParams.get("head_sha"),SHA);
        assert.equal(url.searchParams.get("branch"),"main");
        assert.equal(url.searchParams.get("status"),"success");
        return {ok:true,json:async()=>({workflow_runs:[eligibleRun]})};
      }
      assert.equal(url.pathname,"/repos/aitishnyk/KumaEdge/actions/runs/321/artifacts");
      return {ok:true,json:async()=>({artifacts:[{
        name:"kumaedge-oci-digests-"+SHA,expired:false,size_in_bytes:512
      }]})};
    }
  });
  assert.equal(called,2);
  assert.deepEqual(result,{sha:SHA,verified:true,runId:321});
});

test("GitHub API failures and missing authenticated evidence always refuse deployment", async () => {
  await assert.rejects(checkMainRelease(SHA,{
    repo:"aitishnyk/KumaEdge",token:"FAKE",
    request:async()=>({ok:false,status:403})
  }),/lookup failed/);
  await assert.rejects(checkMainRelease(SHA,{
    repo:"aitishnyk/KumaEdge",token:"FAKE",
    request:async()=>({ok:true,json:async()=>({workflow_runs:[{...eligibleRun,event:"pull_request"}]})})
  }),/No completed/);
  await assert.rejects(checkMainRelease(SHA,{
    repo:"aitishnyk/KumaEdge",token:"FAKE",
    request:async (url) => ({ok:true,json:async()=> url.pathname.endsWith("/artifacts")
      ? {artifacts:[]} : {workflow_runs:[eligibleRun]}})
  }),/No successful main push publisher/);
  await assert.rejects(checkMainRelease(SHA,{
    repo:"aitishnyk/KumaEdge",token:"",
    request:async()=>{throw Error("Must not fetch with missing credentials");}
  }),/GITHUB_TOKEN missing/);
});

test("unambiguous missing manifests differ from registry failure or authentication error", () => {
  assert.equal(classifyManifest({status:0,stderr:""}),"present");
  assert.equal(classifyManifest({status:1,stderr:"no such manifest: fake:tag"}),"missing");
  assert.equal(classifyManifest({status:1,stderr:"manifest unknown: fake:tag"}),"missing");
  assert.equal(classifyManifest({status:1,stderr:"Error response from daemon: no such manifest: fake:tag"}),"missing");
  assert.equal(classifyManifest({status:1,stderr:"Error response from daemon: manifest unknown: manifest unknown"}),"missing");
  assert.equal(classifyManifest({status:1,stderr:"Error parsing HTTP 404: MANIFEST_UNKNOWN"}),"missing");
  assert.throws(()=>classifyManifest({status:1,stderr:"manifest unknown; unauthorized 401"}),/safely/);

  for(const stderr of [
    "unauthorized: authentication required",
    "denied: access forbidden",
    "dial tcp: connection refused",
    "context deadline exceeded",
    "429 Too Many Requests",
    "404 page not found",
    ""
  ]) {
    assert.throws(()=>classifyManifest({status:1,stderr}),/safely/);
  }
  assert.throws(()=>classifyManifest({status:null,error:new Error("timeout")}),/valid process/);
});

test("two-image publishing never silently repairs partial releases", () => {
  assert.equal(planImagePublish("missing","missing"),"publish");
  assert.equal(planImagePublish("present","present"),"skip");
  assert.throws(()=>planImagePublish("present","missing"),/Only one/);
  assert.throws(()=>planImagePublish("missing","present"),/Only one/);
  assert.throws(()=>planImagePublish("unknown","missing"),/Unknown registry/);
});

test("image guard writes publish outputs only after both manifests were checked", () => {
  const dir=mkdtempSync(join(tmpdir(),"kumaedge-release-"));
  const outputFile=join(dir,"result.txt");
  try {
    let count=0;
    const inspect=(_exe,args) => {
      count++;
      assert.equal(args[0],"manifest");
      assert.equal(args[1],"inspect");
      assert.match(args[2],/^ghcr.io\/aitishnyk\/kumaedge(?:-backup)?:[a-f0-9]{40}$/);
      return {status:1,stderr:"no such manifest: "+args[2]};
    };
    assert.equal(guardRelease("aitishnyk/kumaedge",SHA,{inspect,outputFile}),"publish");
    assert.equal(count,2);
    assert.equal(readFileSync(outputFile,"utf8"),"publish=true\n");
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test("workflow gates Bunny mutations after source provenance and registry checks", () => {
  const deploy=readFileSync(".github/workflows/deploy-managed.yml","utf8");
  const build=readFileSync(".github/workflows/bunny-managed-image.yml","utf8");
  const check=deploy.indexOf("node scripts/verify-release-provenance.mjs");
  const registry=deploy.indexOf("Verify release image exists before Bunny changes");
  const bunny=deploy.indexOf("Deploy prebuilt immutable tag to Bunny");
  assert.ok(check>0 && check<registry && registry<bunny);
  assert.match(deploy,/actions: read/);
  assert.match(deploy,/Production dispatch must use main/);
  assert.match(build,/concurrency:/);
  assert.match(build,/node scripts\/guard-ghcr-publish.mjs/);
  assert.match(build,/steps.image_guard.outputs.publish == 'true'/);
});
