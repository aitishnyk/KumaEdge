import test from "node:test";
import assert from "node:assert/strict";
import { classifyHttpResult } from "../src/probe/status.js";

test("classifies exact expected status", () => {
  assert.deepEqual(classifyHttpResult({status:200,durationMs:43}), {
    ok:true,status:200,expectedStatus:200,durationMs:43
  });
});
test("marks mismatches down", () => {
  assert.equal(classifyHttpResult({status:503,durationMs:25}).ok,false);
});
test("allows explicit expected status", () => {
  assert.equal(classifyHttpResult({status:204,expectedStatus:204,durationMs:0}).ok,true);
});
test("rejects invalid inputs", () => {
  assert.throws(()=>classifyHttpResult({status:700,durationMs:2}),RangeError);
  assert.throws(()=>classifyHttpResult({status:200,durationMs:-1}),RangeError);
  assert.throws(()=>classifyHttpResult({status:200,durationMs:NaN}),RangeError);
});
