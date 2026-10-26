#!/usr/bin/env python3
"""Post-approval real Bunny provisioning, demo, backup, closed-client interval/restart."""
import json,os,pathlib,subprocess,sys,tempfile,time
from private_store import credential
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];d=r/'.local-deployments/E2quWe26NmOfL7q';sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip();image='kumaedge-local:'+sha
if subprocess.check_output(['git','status','--porcelain'],cwd=r,text=True).strip():raise SystemExit('Exact clean source required')
def run(script,*args):subprocess.run(['python3',str(r/'scripts/local'/script),*args],cwd=r,check=True)
def ready():
 for _ in range(90):
  app=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q'],text=True,stderr=subprocess.DEVNULL))
  overview=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q/overview'],text=True,stderr=subprocess.DEVNULL))
  pods=[p for region in overview.get('regions',[]) for p in region.get('pods',[])]
  digest=json.loads((r/'.local-release'/sha/'evidence.json').read_text())['images']['main']['digest']
  if app['status']=='active' and len(pods)==1 and pods[0]['status']=='ready' and all(c['imageTag']==sha for c in app['containerTemplates']) and all(c['image'].endswith('@'+digest) for c in pods[0]['containers']):return
  time.sleep(2)
 raise RuntimeError('Exact candidate did not become ready')
def demo(old=None):
 name='kumaedge-public-demo-'+str(os.getpid());env=dict(os.environ,KUMAEDGE_FRONT_DOOR_PASSWORD=(d/'owner-gateway-password.private').read_text(),KUMAEDGE_DEMO_PASSWORD=credential('demo'))
 if old:env['KUMAEDGE_OLD_DEMO_COOKIE']=old
 try:
  args=['docker','create','--name',name]
  for key in ['KUMAEDGE_FRONT_DOOR_PASSWORD','KUMAEDGE_DEMO_PASSWORD','KUMAEDGE_OLD_DEMO_COOKIE']:
   if key in env:args+=['-e',key]
  args+=['--entrypoint','node',image,'/app/demo-live-check.cjs']
  subprocess.run(args,env=env,check=True,stdout=subprocess.DEVNULL);subprocess.run(['docker','cp',str(r/'scripts/local/demo-live-check.cjs'),name+':/app/demo-live-check.cjs'],check=True);subprocess.run(['docker','start','-a',name],check=True,timeout=150)
  if subprocess.check_output(['docker','inspect','-f','{{.State.ExitCode}}',name],text=True).strip()!='0':raise RuntimeError('Public demo acceptance failed')
  with tempfile.TemporaryDirectory(prefix='demo-session-',dir=d) as tmp:
   tmp=pathlib.Path(tmp)
   subprocess.run(['docker','cp',name+':/tmp/demo-live-cookie.private',str(tmp/'cookie')],check=True);subprocess.run(['docker','cp',name+':/tmp/demo-live-report.json',str(tmp/'report')],check=True)
   cookie=(tmp/'cookie').read_text();report=json.loads((tmp/'report').read_text());return cookie,report
 finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ready();run('bootstrap-live.py');cookie,initial=demo();run('bootstrap-live.py','check');before=json.loads((d/'live-owner-check.json').read_text())
print('Operator clients closed; waiting 105 seconds for independent heartbeat collection',flush=True);time.sleep(105)
run('bootstrap-live.py','check');after=json.loads((d/'live-owner-check.json').read_text())
for key,count in before['history'].items():
 if after['history'].get(key,0)<=count:raise RuntimeError('No independent heartbeat growth')
run('bunny-full-backup.py')
volumes_before=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q/volumes'],text=True))
subprocess.run(['bunny','api','POST','/mc/apps/E2quWe26NmOfL7q/restart'],check=True,stdout=subprocess.DEVNULL)
print('Existing app restart requested; verifying same data volume and fail-closed demo sessions',flush=True);time.sleep(10);ready()
volumes_after=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q/volumes'],text=True))
for volumes in [volumes_before,volumes_after]:
 if len(volumes['items'])!=1 or volumes['items'][0]['id']!='117a1d40-18e4-4041-b8f7-57e2603cd32a':raise RuntimeError('Existing volume identity changed')
if {x['id'] for x in volumes_before['items'][0]['volumeInstances']}!={x['id'] for x in volumes_after['items'][0]['volumeInstances']}:raise RuntimeError('Node-local volume instance changed')
_,final=demo(cookie);run('bootstrap-live.py','check');persisted=json.loads((d/'live-owner-check.json').read_text())
for key,count in after['history'].items():
 if persisted['history'].get(key,0)<count:raise RuntimeError('History lost after agreed restart')
report={'sha':sha,'scope':'ACTUAL_BUNNY','owner':persisted,'demo':final,'closedOperatorClientsIntervalSeconds':105,'independentMonitoring':'PASS','sameVolumeRestart':'PASS','BUNNY_SOURCE_FULL_BACKUP':'PASS','LOCAL_ISOLATED_RESTORE':'PASS','BUNNY_TO_BUNNY_RESTORE':'NOT_RUN','externalNotifications':'NOT_VERIFIED_NO_AUTHORIZED_CHANNEL','readiness':'DEMO_READY_PENDING_REMAINING_GATES'}
(d/'live-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
