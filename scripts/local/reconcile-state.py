#!/usr/bin/env python3
"""Copy legacy private state into the deployment backend without any cloud writes."""
import hashlib,json,os,pathlib,shutil,subprocess,sys
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2]
if len(sys.argv)!=2:raise SystemExit('Usage: reconcile-state.py /absolute/path/to/legacy/terraform.tfstate')
old=pathlib.Path(sys.argv[1]).resolve();s=json.loads(old.read_text());ids=[i['attributes']['id'] for x in s['resources'] if x['type']=='bunnynet_compute_container_app' for i in x['instances']]
if len(ids)!=1 or not ids[0].isalnum():raise SystemExit('Exactly one existing application state is required')
app=ids[0];live=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/'+app],text=True));assert live['id']==app
if live['displayEndpoint']['address']!='mc-b4n2u1709h.bunny.run':raise SystemExit('Unexpected deployment; refusing migration')
d=r/'.local-deployments'/app;d.mkdir(parents=True,exist_ok=True);d.chmod(0o700)
for source,target in [(old,d/'terraform.tfstate'),(old.parent/'owner-gateway-password.private',d/'owner-gateway-password.private')]:
 if target.exists():
  if target.read_bytes()!=source.read_bytes():raise SystemExit('Destination differs; reconcile manually, never overwrite current state')
 else:shutil.copyfile(source,target)
 target.chmod(0o600)
backup=d/'legacy-state.private.backup'
if not backup.exists():shutil.copyfile(old,backup)
assert hashlib.sha256(backup.read_bytes()).digest()==hashlib.sha256(old.read_bytes()).digest()
subprocess.run(['terraform','-chdir='+str(r/'infra/bunny'),'init','-reconfigure','-input=false','-backend-config=path='+str(d/'terraform.tfstate')],check=True)
print('Private deployment backend reconciled. Run a reviewed no-op plan before updates. Legacy state is an archive; never apply it again.')
