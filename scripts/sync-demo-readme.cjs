'use strict';
const fs=require('fs'),path=require('path'),links=require('./demo-public.cjs');
const file=path.join(__dirname,'../README.md'),start='<!-- demo-showcase:start -->',end='<!-- demo-showcase:end -->';
const anchor=(url,label)=>`<a href="${url}" target="_blank" rel="noopener noreferrer sponsored"><strong>${label} ↗</strong></a>`;
const section=`${start}
## See KumaEdge in action

${anchor('https://mc-b4n2u1709h.bunny.run/demo','Live Demo')} &nbsp; · &nbsp; ${anchor(links.bunnyAffiliate,'Deploy with Bunny.net')} *(affiliate link)*

![KumaEdge Obsidian Cloud dashboard — real recorded monitoring data](docs/images/demo-desktop.jpg)

Real availability, response-time charts, recent check history and recorded events,
in a responsive, read-only interface. Hosted on Bunny Magic Containers, powered by
original [Uptime Kuma](${links.upstream}) 2.5.7. No fabricated monitoring results.

**Demo access:** open **Live Demo**, sign in as \`demo\` with the separate demo password
shared by the project maintainer. OWNER gateway and Kuma admin credentials do not
work for DEMO and must never be published. The demo cannot edit monitors or access
private targets, settings, keys or SQLite. The screenshot shows a real disposable
local acceptance dataset, not a production availability guarantee.

${anchor(links.bunnyAffiliate,'Hosted on Bunny.net')} · ${anchor(links.github,'View on GitHub')}

*${links.disclosure}* KumaEdge is an independent MIT-licensed open-source project,
not an official product of Bunny.net or Uptime Kuma.
${end}`;
const source=fs.readFileSync(file,'utf8');if(!source.includes(start)||!source.includes(end))throw Error('README showcase markers missing');
const updated=source.slice(0,source.indexOf(start))+section+source.slice(source.indexOf(end)+end.length);
if(process.argv.includes('--check')){if(updated!==source){console.error('README showcase differs from canonical public links; run node scripts/sync-demo-readme.cjs');process.exitCode=1;}}else fs.writeFileSync(file,updated);
