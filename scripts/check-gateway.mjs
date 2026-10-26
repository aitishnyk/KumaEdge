#!/usr/bin/env node
// Public, read-only checks for the protected two-container gateway. No credentials.
import {parseEndpoint,reviewCacheHeaders} from '../src/acceptance/public-endpoint.js';
import {isDirectInvocation} from './cli-entrypoint.mjs';
export async function checkGateway(url,{fetchImpl=fetch}={}){
 const origin=parseEndpoint(url,{publicOnly:true});const routes={'/':401,'/setup':401,'/dashboard':401,'/api/entry-page':401,'/socket.io/?EIO=4&transport=polling':401,'/healthz':200};
 for(const [route,status] of Object.entries(routes)){
  const response=await fetchImpl(origin+route,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  try{if(response.status!==status)throw Error('Unexpected public gateway status for '+route);if(!reviewCacheHeaders(response.headers).safe)throw Error('Unsafe edge cache policy for '+route);}finally{await response.body?.cancel();}
 }
 return {HTTPS:'PASS',publicOwnerGate:'PASS',privateNoStore:'PASS',unauthenticatedSocketDenied:'PASS',authenticatedWebSocket:'REQUIRES_OWNER_LIVE_TEST',readiness:'TRANSPORT_GATE_ONLY'};
}
if(isDirectInvocation(import.meta.url)){
 const i=process.argv.indexOf('--url');try{console.log(JSON.stringify(await checkGateway(i>=0?process.argv[i+1]:''),null,2));}catch(e){console.error('Gateway check failed:',e.message);process.exitCode=1;}
}
