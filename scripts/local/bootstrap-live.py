#!/usr/bin/env python3
"""Run only after the exact approved image/reset plan is applied to existing app."""
import json,os,pathlib,secrets,subprocess,sys,tempfile
from private_store import credential
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];d=r/'.local-deployments/E2quWe26NmOfL7q';sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()
app=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q'],text=True))
if any(c['imageTag']!=sha for c in app['containerTemplates']):raise SystemExit('Exact reviewed candidate must be deployed before live provisioning')
if {c['name'] for c in app['containerTemplates']}!={'kumaedge','owner-gateway'}:raise SystemExit('Unexpected app inventory')
try:password=credential('__owner-admin')
except RuntimeError:
 if len(sys.argv)>1 and sys.argv[1]=='check':raise SystemExit('Local owner credentials unavailable')
 password=secrets.token_urlsafe(48);credential('__owner-admin',password)
try:totp=credential('__owner-totp')
except RuntimeError:totp=''
if len(sys.argv)>1 and sys.argv[1]=='check' and not totp:raise SystemExit('Trusted local TOTP identity required for read-back checks')
ops=json.loads((d/'engine.private.json').read_text())
e=dict(os.environ,KUMAEDGE_PUBLIC_URL='https://mc-b4n2u1709h.bunny.run',KUMAEDGE_FRONT_DOOR_PASSWORD=(d/'owner-gateway-password.private').read_text(),KUMAEDGE_OWNER_PASSWORD=password,KUMAEDGE_OWNER_TOTP_SECRET=totp,KUMAEDGE_OPS_TOKEN=ops['KUMAEDGE_OPS_TOKEN'],KUMAEDGE_PERMIT_FRESH_SETUP='true',KUMAEDGE_BOOTSTRAP_MODE='check' if len(sys.argv)>1 and sys.argv[1]=='check' else 'bootstrap')
name='kumaedge-live-operator-'+str(os.getpid())
try:
 args=['docker','create','--name',name]
 for key in e:
  if key.startswith('KUMAEDGE_'):args+=['-e',key]
 args+=['--entrypoint','node','kumaedge-local:'+sha,'/app/bootstrap-live.cjs']
 subprocess.run(args,env=e,cwd=r,check=True,stdout=subprocess.DEVNULL);subprocess.run(['docker','cp',str(r/'scripts/local/bootstrap-live.cjs'),name+':/app/bootstrap-live.cjs'],check=True)
 # Output contains only fixed progress strings. Secret enrollment goes to a private
 # ephemeral file, never stdout/Docker logs or public evidence.
 subprocess.run(['docker','start','-a',name],timeout=600,check=True)
 code=subprocess.check_output(['docker','inspect','-f','{{.State.ExitCode}}',name],text=True).strip()
 with tempfile.TemporaryDirectory(prefix='kumaedge-owner-',dir=d) as tmp:
  tmp=pathlib.Path(tmp);tmp.chmod(0o700)
  result=subprocess.run(['docker','cp',name+':/tmp/kumaedge-bootstrap-secrets.private.json',str(tmp/'secret')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if result.returncode==0:credential('__owner-totp',json.loads((tmp/'secret').read_text())['totpSecret'])
  if code!='0':raise SystemExit('Live phase incomplete; local Keychain enrollment preserved, no fake PASS')
  subprocess.run(['docker','cp',name+':/tmp/kumaedge-bootstrap-result.json',str(tmp/'result')],check=True)
  report=json.loads((tmp/'result').read_text());(d/('live-owner-check.json' if e['KUMAEDGE_BOOTSTRAP_MODE']=='check' else 'live-bootstrap.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:
 # Preserve a newly enrolled factor even when a later monitoring phase times out.
 with tempfile.TemporaryDirectory(prefix='kumaedge-factor-',dir=d) as folder:
  target=pathlib.Path(folder)/'secret'
  copied=subprocess.run(['docker','cp',name+':/tmp/kumaedge-bootstrap-secrets.private.json',str(target)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if copied.returncode==0:credential('__owner-totp',json.loads(target.read_text())['totpSecret'])
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

