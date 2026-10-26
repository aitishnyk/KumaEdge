#!/usr/bin/env python3
"""Owner-only trusted terminal interaction; no credentials in argv or evidence."""
import getpass,json,os,pathlib,subprocess,sys
os.umask(0o077)
if not sys.stdin.isatty():raise SystemExit('Run directly in the owner terminal')
r=pathlib.Path(__file__).resolve().parents[2];sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip();d=r/'.local-deployments/E2quWe26NmOfL7q'
e=dict(os.environ,KUMAEDGE_FRONT_DOOR_PASSWORD=(d/'owner-gateway-password.private').read_text(),KUMAEDGE_OWNER_USERNAME=input('Existing Kuma admin username: ').strip(),KUMAEDGE_OWNER_PASSWORD=getpass.getpass('Kuma admin password: '),KUMAEDGE_OWNER_TOTP=getpass.getpass('Current TOTP code: '))
name='kumaedge-owner-live-'+str(os.getpid())
try:
 args=['docker','create','--name',name]
 for key in ['KUMAEDGE_FRONT_DOOR_PASSWORD','KUMAEDGE_OWNER_USERNAME','KUMAEDGE_OWNER_PASSWORD','KUMAEDGE_OWNER_TOTP']:args+=['-e',key]
 args+=['--entrypoint','node','kumaedge-local:'+sha,'/app/owner-live-check.cjs']
 subprocess.run(args,env=e,cwd=r,check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['docker','cp',str(r/'scripts/local/owner-live-check.cjs'),name+':/app/owner-live-check.cjs'],check=True)
 result=subprocess.run(['docker','start','-a',name],capture_output=True,text=True,timeout=75)
 code=subprocess.check_output(['docker','inspect','-f','{{.State.ExitCode}}',name],text=True).strip()
 if code!='0':raise SystemExit('Owner live check did not pass. Secrets were not written to evidence.')
 report=json.loads(result.stdout.strip());(d/'owner-live-check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for k in list(e):
  if k.startswith('KUMAEDGE_OWNER_') or k=='KUMAEDGE_FRONT_DOOR_PASSWORD':e[k]=''
