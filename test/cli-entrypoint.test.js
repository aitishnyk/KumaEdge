import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectInvocation } from "../scripts/cli-entrypoint.mjs";

const entries=[
  ["scripts/verify-release-provenance.mjs","Release provenance FAILED:"],
  ["scripts/oci-release-evidence.mjs","OCI release evidence FAILED:"],
  ["scripts/preflight-bunny-install.mjs","Bunny image pin preflight FAILED:"],
  ["scripts/guard-ghcr-publish.mjs","GHCR release blocked:"]
];

test("direct CLI detection resolves logical symlinks and escaped file URLs",()=>{
  const dir=mkdtempSync(join(tmpdir(),"kumaedge entrypoint-"));
  try {
    const real=join(dir,"real source.mjs");
    writeFileSync(real,"export const ok=true;\n");
    const link=join(dir,"shortcut source.mjs");
    symlinkSync(real,link);
    assert.equal(isDirectInvocation(pathToFileURL(real).href,link),true);
    assert.equal(isDirectInvocation(pathToFileURL(real).href,real),true);
    assert.equal(isDirectInvocation(pathToFileURL(real).href,join(dir,"missing.mjs")),false);
    assert.equal(isDirectInvocation(pathToFileURL(real).href,null),false);
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});

test("all four CLI scripts fail closed when invoked through a symlinked directory",()=>{
  const dir=mkdtempSync(join(tmpdir(),"kumaedge symlink CLI-"));
  try {
    const source=realpathSync(".");
    const alias=join(dir,"symlinked project");
    symlinkSync(source,alias,"dir");
    for(const [entry,diagnostic] of entries) {
      const run=spawnSync(process.execPath,[join(alias,entry)],{
        cwd:source,encoding:"utf8",timeout:20000,
        env:{...process.env,GITHUB_REPOSITORY:"",GITHUB_SHA:"",
          GITHUB_TOKEN:"",IMAGE_TAG:"",TF_VAR_image_tag:""}
      });
      assert.equal(run.status,1,entry+" should fail closed, not silently exit 0: "+run.stderr);
      assert.ok(run.stderr.includes(diagnostic),entry+" missing CLI failure prefix: "+run.stderr);
      assert.equal(run.stdout,"",entry+" emitted unexpected output");
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test("each CLI module is inert on import by another process",()=>{
  for(const [entry] of entries){
    const target=pathToFileURL(resolve(entry)).href;
    const result=spawnSync(process.execPath,["--input-type=module","-e","await import(process.argv[1])",target],{
      encoding:"utf8",timeout:20000
    });
    assert.equal(result.status,0,entry+" import should remain safe: "+result.stderr);
    assert.equal(result.stdout,"",entry+" should not execute on import");
    assert.equal(result.stderr,"",entry+" import should not emit errors");
  }
});
