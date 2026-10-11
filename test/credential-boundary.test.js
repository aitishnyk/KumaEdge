import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";

test("all public Github Actions workflows forbid account-level Bunny keys",()=>{
  const dir=".github/workflows";
  const workflows=readdirSync(dir).filter(x=>x.endsWith(".yml")||x.endsWith(".yaml"));
  assert.ok(workflows.length>=10);
  for(const name of workflows) {
    const content=readFileSync(dir+"/"+name,"utf8");
    assert.doesNotMatch(content,/\bBUNNYNET_API_KEY\b|\bBUNNY_KEY\b|container-update-image|bunny\.net\/api/i,
      "Public workflow must not expose the account key or mutate Bunny: "+name);
  }
});

test("installer retains TTY-only secret prompt and explicit paid plan confirmation",()=>{
  const content=readFileSync("scripts/install-bunny.sh","utf8");
  assert.match(content,/! -t 0/);
  assert.match(content,/read -r -s -p "Bunny account API key/);
  assert.match(content,/CREATE KUMAEDGE/);
  assert.match(content,/terraform plan -input=false/);
  assert.match(content,/terraform apply -input=false/);
  assert.doesNotMatch(content,/terraform apply[^\n]*-auto-approve/);
});

test("published credential guide makes GitHub and state boundaries clear",()=>{
  const guide=readFileSync("docs/BUNNY_LOCAL_CREDENTIALS.md","utf8");
  assert.match(guide,/Account API Key/);
  assert.match(guide,/GitHub Actions Secrets/);
  assert.match(guide,/Terraform state/);
  assert.match(guide,/trusted local terminal/);
  assert.match(guide,/NEVER.*(?:place|store)/i);
});
