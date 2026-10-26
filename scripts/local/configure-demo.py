#!/usr/bin/env python3
"""Run directly in a trusted owner terminal. Never put passwords in argv or chat."""
import getpass,hashlib,json,os,pathlib,secrets,sys
os.umask(0o077)
if not sys.stdin.isatty():raise SystemExit('Owner terminal required')
root=pathlib.Path(__file__).resolve().parents[2]
deployment=root/'.local-deployments'/os.environ.get('KUMAEDGE_DEPLOYMENT_ID','E2quWe26NmOfL7q')
if not (deployment/'terraform.tfstate').is_file():raise SystemExit('Reconcile deployment state first')
output=deployment/'demo.private.json'
if output.exists():raise SystemExit('Existing config retained. Explicitly move it to a private backup before intentional credential rotation.')
p=getpass.getpass('New demo password (16–1024 bytes, never owner/admin password): ')
if p!=getpass.getpass('Confirm demo password: ') or not 16<=len(p.encode())<=1024:raise SystemExit('Invalid password')
if p==(deployment/'owner-gateway-password.private').read_text():raise SystemExit('Owner and demo passwords must differ')
salt=secrets.token_bytes(16);h=hashlib.scrypt(p.encode(),salt=salt,n=16384,r=8,p=1,dklen=32).hex();p=None
slug=input('Existing PUBLIC Kuma status-page slug (blank gives honest empty state): ').strip()
services=[]
if slug:
 print('Allowlist PUBLIC monitor IDs with deliberately public labels; blank ID finishes.')
 while True:
  value=input('Public monitor ID: ').strip()
  if not value:break
  services.append({'id':int(value),'label':input('Public label: ').strip()})
data={'KUMAEDGE_DEMO_ENABLED':'true','KUMAEDGE_DEMO_USERNAME':'demo','KUMAEDGE_DEMO_PASSWORD_HASH':'scrypt$16384$8$1$'+salt.hex()+'$'+h,'KUMAEDGE_DEMO_SESSION_SECRET':secrets.token_urlsafe(48),'KUMAEDGE_DEMO_SESSION_TTL':'3600','KUMAEDGE_DEMO_PUBLIC_TITLE':'Service health','KUMAEDGE_PUBLIC_ORIGIN':'https://mc-b4n2u1709h.bunny.run','KUMAEDGE_DEMO_STATUS_PAGE':slug,'KUMAEDGE_DEMO_SERVICES':json.dumps(services)}
with output.open('x') as f:json.dump(data,f)
output.chmod(0o600)
print('Private demo config saved; password not retained. Sessions reset on gateway restart or credential rotation.')
