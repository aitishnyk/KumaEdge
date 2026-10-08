export function summarizeSamples(samples,{from,to}) {
  if (!Number.isFinite(from)||!Number.isFinite(to)||from>=to)throw new RangeError("Invalid window");
  if(!Array.isArray(samples))throw new TypeError("Invalid samples");
  let up=0,down=0;
  for(const s of samples){
    if(!s||typeof s.up!=="boolean"||!Number.isFinite(s.at))throw new TypeError("Invalid sample");
    if(s.at>=from&&s.at<to)s.up?up++:down++;
  }
  const checked=up+down;
  return {up,down,checked,availabilityPercent:checked?Math.round(up/checked*10000)/100:null,coverage:"observed-checks-only"};
}
