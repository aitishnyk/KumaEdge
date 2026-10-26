#!/usr/bin/env python3
"""Stage only the explicitly requested public-demo verifier/mode/session rotation.
No Bunny mutation; the exact resulting Terraform plan still needs human approval.
"""
import json,os,pathlib,secrets,hashlib,shutil
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];d=r/'.local-deployments/E2quWe26NmOfL7q';p=d/'demo.private.json'
state=json.loads((d/'terraform.tfstate').read_text());ids=[i['attributes']['id'] for x in state['resources'] if x['type']=='bunnynet_compute_container_app' for i in x['instances']]
if ids!=['E2quWe26NmOfL7q']:raise SystemExit('Wrong private state; no rotation')
data=json.loads(p.read_text());backup=d/'v0202-before-demo.private.json'
if backup.exists():raise SystemExit('Existing staged rotation retained; inspect privately, do not overwrite')
shutil.copy2(p,backup);salt=secrets.token_bytes(16)
data.update(KUMAEDGE_DEMO_PUBLIC_CREDENTIALS='true',KUMAEDGE_DEMO_USERNAME='demo',KUMAEDGE_DEMO_PASSWORD_HASH='scrypt$16384$8$1$'+salt.hex()+'$'+hashlib.scrypt(b'demo',salt=salt,n=16384,r=8,p=1,dklen=32).hex(),KUMAEDGE_DEMO_SESSION_SECRET=secrets.token_urlsafe(48))
p.write_text(json.dumps(data));p.chmod(0o600)
print('Staged public DEMO verifier/mode/session secret only; private old config retained; apply not run')
