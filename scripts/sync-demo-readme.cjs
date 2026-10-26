 'use strict';
const fs=require('fs'),path=require('path'),links=require('./demo-public.cjs');
const file=path.join(__dirname,'../README.md'),start='<!-- demo-showcase:start -->',end='<!-- demo-showcase:end -->';
const anchor=(url,label)=>`<a href="${url}" target="_blank" rel="noopener noreferrer sponsored"><strong>${label} ↗</strong></a>`;
const section=`${start}
<p align="center">${anchor('https://mc-b4n2u1709h.bunny.run/demo','Live Demo')} &nbsp; · &nbsp; <a href="#quick-start"><strong>Quick Start</strong></a> &nbsp; · &nbsp; ${anchor(links.bunnyAffiliate,'Deploy on Bunny.net')} &nbsp; · &nbsp; <a href="docs/README.md"><strong>Documentation</strong></a></p>

<p align="center"><em>Deploy on Bunny.net is an affiliate link. ${links.disclosure}</em></p>

## See real monitoring in action

![KumaEdge desktop DEMO dashboard showing actual service health and recorded response history](docs/assets/screenshots/demo-desktop.jpg)

<p align="center"><img src="docs/assets/screenshots/demo-mobile.jpg" width="300" alt="KumaEdge mobile DEMO dashboard with real service cards, response charts and recorded events"></p>

### Try the Live Demo

| | Public access |
|---|---|
| URL | https://mc-b4n2u1709h.bunny.run/demo |
| Username | \`demo\` |
| Password | \`demo\` |
| Access | **Read-only** |

No invitation or individual password request. The public demo cannot edit monitors, manage notifications or access private targets, OWNER APIs, admin sessions, keys or SQLite. Every metric comes from actual recorded checks; screenshots are not an availability guarantee.

${anchor(links.bunnyAffiliate,'Hosted on Bunny.net')} · ${anchor(links.github,'View on GitHub')} · ${anchor(links.upstream,'Powered by Uptime Kuma')}
${end}`;
const source=fs.readFileSync(file,'utf8');if(!source.includes(start)||!source.includes(end))throw Error('README showcase markers missing');
const updated=source.slice(0,source.indexOf(start))+section+source.slice(source.indexOf(end)+end.length);
if(process.argv.includes('--check')){if(updated!==source){console.error('README showcase differs from canonical public links; run node scripts/sync-demo-readme.cjs');process.exitCode=1;}}else fs.writeFileSync(file,updated);
