import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("Production updater preflights both images before changing Bunny", () => {
  const workflow = readFileSync(".github/workflows/deploy-managed.yml", "utf8");
  const check = workflow.indexOf('docker manifest inspect "ghcr.io/${repo_lower}-backup:$TAG"');
  const deployMain = workflow.indexOf("      - name: Deploy prebuilt immutable tag to Bunny");
  const deployBackup = workflow.indexOf("      - name: Update optional SQLite backup worker");
  assert.ok(check > 0 && check < deployMain);
  assert.ok(deployBackup > deployMain);
  assert.match(workflow,/vars.BUNNY_MC_BACKUP_ENABLED == 'true'/);
  assert.match(workflow,/container: sqlite-offsite-backup/);
  assert.doesNotMatch(workflow,/container-update-image@main/);
});
