#!/usr/bin/env node
import { auditEndpoint } from "../src/acceptance/public-endpoint.js";

function arg(name, fallback) {
  const i=process.argv.indexOf(name);
  return i>=0 ? process.argv[i+1] : fallback;
}
const url=arg("--url","");
const mode=arg("--mode","production");
const allowLocalHttp=process.argv.includes("--allow-local-http");
const requireHsts=process.argv.includes("--require-hsts");
if(!url){
  console.error("Usage: node scripts/check-production.mjs --url https://monitor.example.com [--mode production|smoke] [--require-hsts]");
  process.exit(2);
}
try {
  const audit=await auditEndpoint(url,{allowLocalHttp,mode,requireHsts});
  console.log(JSON.stringify(audit,null,2));
  if(mode==="smoke") console.log("SMOKE ONLY: HTTPS/cache checks require production mode.");
  else console.log("Transport/cache acceptance passed. Test login, 2FA, notifications, volume restart and backups manually.");
} catch(error){
  console.error("ACCEPTANCE FAILED:",error.message);
  process.exitCode=1;
}
