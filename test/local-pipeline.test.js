import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
test('release refuses unreviewed and dirty source before building or publishing', () => {
  const result=spawnSync('bash',['scripts/local/build.sh'],{encoding:'utf8',env:{...process.env,KUMAEDGE_REVIEWED_SHA:''}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/exact reviewed HEAD/);
});
test('no active GitHub Actions workflows remain', () => {
  assert.deepEqual(readdirSync('.github/workflows').filter(x=>/\.ya?ml$/.test(x)),[]);
});
