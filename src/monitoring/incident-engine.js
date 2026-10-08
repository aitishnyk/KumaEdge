export function initialState(id) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) throw new TypeError("Invalid monitor id");
  return { id, status:"unknown", failures:0, successes:0, incidentId:null, lastCheckedAt:null, updatedAt:null };
}
export function applyObservation(previous, observation, options={}) {
  if (!previous || !["unknown","up","down"].includes(previous.status)) throw new TypeError("Invalid state");
  const fail=options.failureThreshold??2, recover=options.recoveryThreshold??2;
  if (![fail,recover].every(n=>Number.isInteger(n)&&n>=1&&n<=100)) throw new RangeError("Invalid thresholds");
  if (!observation || typeof observation.up!=="boolean" || !Number.isSafeInteger(observation.at) || observation.at<=0) throw new TypeError("Invalid observation");
  if (previous.lastCheckedAt!==null && observation.at<=previous.lastCheckedAt) return {state:{...previous},events:[],ignored:true};
  const state={...previous,lastCheckedAt:observation.at},events=[];
  if (observation.up) {
    state.successes=Math.min(state.successes+1,recover);state.failures=0;
    if(state.successes>=recover&&state.status!=="up"){
      if(state.status==="down")events.push({type:"recovered",monitorId:state.id,incidentId:state.incidentId,at:observation.at});
      state.status="up";state.incidentId=null;state.updatedAt=observation.at;
    }
  } else {
    state.failures=Math.min(state.failures+1,fail);state.successes=0;
    if(state.failures>=fail&&state.status!=="down"){
      state.incidentId=state.id+":"+observation.at;state.status="down";state.updatedAt=observation.at;
      events.push({type:"down",monitorId:state.id,incidentId:state.incidentId,at:observation.at});
    }
  }
  return {state,events,ignored:false};
}
