'use strict';
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const date=t=>t?new Date(t.includes('T')?t:t.replace(' ','T')+'Z').toLocaleString():'No checks yet';
async function refresh(){
 const summary=document.querySelector('#summary'),grid=document.querySelector('#services');
 try{const r=await fetch('/demo/api/status',{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.replace('/demo/login');return;}if(!r.ok)throw Error();const d=await r.json();grid.replaceChildren();
 summary.textContent=d.state==='empty'?'No public services have been shared yet.':`${d.services.filter(s=>s.status===1).length} of ${d.services.length} services operational`;
 for(const s of d.services){const card=make('article',undefined,'card');card.append(make('h2',s.label),make('span',s.status===1?'UP':s.status===0?'DOWN':s.status===3?'MAINTENANCE':'PENDING','badge '+(s.status===1?'up':s.status===0?'down':'')),make('p',s.responseMs===null?'—':Math.round(s.responseMs)+' ms','metric'),make('p','Latest response time','muted'));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 70');svg.setAttribute('class','history');svg.setAttribute('role','img');svg.setAttribute('aria-label','Recent recorded response times');const good=s.history.filter(b=>b.ping!==null),max=Math.max(1,...good.map(b=>b.ping));if(good.length>1){const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',good.map((b,i)=>`${i*300/(good.length-1)},${65-b.ping*60/max}`).join(' '));svg.append(line);}card.append(svg,make('p','24h uptime: '+(s.uptime24h===null?'Not available':(s.uptime24h*100).toFixed(2)+'%'),'muted'),make('small','Last check: '+date(s.lastCheck)));grid.append(card);}
 const incidents=document.querySelector('#incidents');incidents.replaceChildren();if(d.state!=='empty'){incidents.append(make('h2','Recent recorded transitions'));if(!d.incidents?.length)incidents.append(make('p','No transitions in the displayed history.','muted'));else for(const event of d.incidents.slice(-10).reverse())incidents.append(make('p',event.label+' · '+event.event+' · '+date(event.time)));}document.querySelector('#updated').textContent='Engine reachable · Last refresh: '+date(d.checkedAt);
 }catch{summary.textContent='Monitoring data is temporarily unavailable. Retrying in 30 seconds.';grid.replaceChildren();}
}
refresh();setInterval(refresh,30000);
