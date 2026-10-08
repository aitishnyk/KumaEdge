import test from "node:test";
import assert from "node:assert/strict";
import {initialState,applyObservation} from "../src/monitoring/incident-engine.js";
import {summarizeSamples} from "../src/monitoring/rollup.js";
test("threshold incidents and recovery",()=>{
let s=initialState("site"),r;
r=applyObservation(s,{up:false,at:100});s=r.state;assert.equal(s.status,"unknown");
r=applyObservation(s,{up:false,at:200});s=r.state;assert.equal(r.events[0].type,"down");const incident=s.incidentId;
r=applyObservation(s,{up:false,at:300});s=r.state;assert.equal(r.events.length,0);
r=applyObservation(s,{up:true,at:400});s=r.state;assert.equal(s.status,"down");
r=applyObservation(s,{up:true,at:500});assert.equal(r.state.status,"up");assert.equal(r.events[0].incidentId,incident);
});
test("ignore replay and stale observations",()=>{
const s=applyObservation(initialState("a"),{up:false,at:200}).state;
assert.deepEqual(applyObservation(s,{up:false,at:200}),{state:s,events:[],ignored:true});
});
test("opposing streak reset",()=>{
let s=initialState("a");s=applyObservation(s,{up:false,at:100}).state;
s=applyObservation(s,{up:true,at:200}).state;
s=applyObservation(s,{up:false,at:300}).state;assert.equal(s.status,"unknown");
});
test("invalid config rejected",()=>{
assert.throws(()=>initialState("../a"),TypeError);
assert.throws(()=>applyObservation(initialState("a"),{up:true,at:1},{failureThreshold:0}),RangeError);
});
test("sample availability never treats missing data as uptime",()=>{
assert.equal(summarizeSamples([],{from:1,to:10}).availabilityPercent,null);
assert.equal(summarizeSamples([{at:3,up:true},{at:5,up:false},{at:10,up:true}],{from:1,to:10}).availabilityPercent,50);
});
