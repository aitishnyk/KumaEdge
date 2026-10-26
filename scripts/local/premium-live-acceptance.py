#!/usr/bin/env python3
"""Premium UI acceptance: read-only Kuma APIs; never saves the original Status Page."""
import hashlib,json,os,pathlib,sqlite3,subprocess,sys,tempfile,time
from private_store import credential
from deployed_release import deployed_release
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];d=r/'.local-deployments/E2quWe26NmOfL7q'
def api(path):return json.loads(subprocess.check_output(['bunny','api','GET',path],text=True,stderr=subprocess.DEVNULL))
def config_snapshot():
 receipt=json.loads((d/'live-backup-restore-receipt.private.json').read_text())
 if hashlib.sha256(pathlib.Path(receipt['encrypted_archive']).read_bytes()).hexdigest()!=receipt['sha256']:raise RuntimeError('Backup digest mismatch')
 with tempfile.TemporaryDirectory(dir=d,prefix='premium-config-') as folder:
  folder=pathlib.Path(folder);identity=folder/'identity';identity.write_text(credential('__backup-age-identity'));identity.chmod(0o600)
  target=folder/'data';subprocess.run(['python3',str(r/'scripts/volume-backup.py'),'restore',receipt['encrypted_archive'],str(identity),str(target)],env={**os.environ,'KUMAEDGE_APP_STOPPED':'yes'},check=True,stdout=subprocess.DEVNULL)
  with sqlite3.connect((target/'kuma.db').as_uri()+'?mode=ro',uri=True) as conn:
   if conn.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise RuntimeError('Snapshot integrity failed')
   tables=[x[0] for x in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")];selected=[t for t in tables if 'status_page' in t or t in ['monitor','group','monitor_group']]
   fields=['username','password','twofa_status','twofa_secret'];columns={row[1] for row in conn.execute('PRAGMA table_info(user)')}
   if not set(fields).issubset(columns):raise RuntimeError('Unknown owner authentication schema')
   auth=conn.execute('SELECT '+','.join('"'+field+'"' for field in fields)+' FROM user ORDER BY id').fetchall()
   if not auth or not any(bool(row[2]) for row in auth):raise RuntimeError('Existing owner/TOTP configuration missing')
   return {'archive_sha256':receipt['sha256'],'ownerAuthHash':hashlib.sha256(repr(auth).encode()).hexdigest(),'tables':{t:hashlib.sha256(repr(conn.execute('SELECT * FROM "'+t+'" ORDER BY rowid').fetchall()).encode()).hexdigest() for t in selected}}
def demo(expected_premium=False,old=None,capture=False):
 app=api('/mc/apps/E2quWe26NmOfL7q');sha=deployed_release(r,app);name='kumaedge-premium-check-'+str(os.getpid());env=dict(os.environ,KUMAEDGE_FRONT_DOOR_PASSWORD=(d/'owner-gateway-password.private').read_text(),KUMAEDGE_DEMO_PASSWORD=credential('demo'))
 if expected_premium:env['KUMAEDGE_EXPECT_PREMIUM']='true'
 if old:env['KUMAEDGE_OLD_DEMO_COOKIE']=old
 try:
  args=['docker','create','--name',name]
  for key in ['KUMAEDGE_FRONT_DOOR_PASSWORD','KUMAEDGE_DEMO_PASSWORD','KUMAEDGE_EXPECT_PREMIUM','KUMAEDGE_OLD_DEMO_COOKIE']:
   if key in env:args+=['-e',key]
  args+=['--entrypoint','node','kumaedge-local:'+sha,'/app/demo-live-check.cjs'];subprocess.run(args,env=env,check=True,stdout=subprocess.DEVNULL);subprocess.run(['docker','cp',str(r/'scripts/local/demo-live-check.cjs'),name+':/app/demo-live-check.cjs'],check=True,stdout=subprocess.DEVNULL);subprocess.run(['docker','start','-a',name],check=True,timeout=180)
  if subprocess.check_output(['docker','inspect','-f','{{.State.ExitCode}}',name],text=True).strip()!='0':raise RuntimeError('Premium public check failed')
  with tempfile.TemporaryDirectory(dir=d,prefix='premium-session-') as temp:
   temp=pathlib.Path(temp);subprocess.run(['docker','cp',name+':/tmp/demo-live-report.json',str(temp/'report')],check=True,stdout=subprocess.DEVNULL);report=json.loads((temp/'report').read_text())
   if capture:subprocess.run(['docker','cp',name+':/tmp/demo-live-cookie.private',str(d/'v0201-pre-update-demo-cookie.private')],check=True,stdout=subprocess.DEVNULL)
   return report
 finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def main():
 if len(sys.argv)>1 and sys.argv[1]=='before':
  (d/'v0201-config-baseline.private.json').write_text(json.dumps(config_snapshot(),indent=2));demo(capture=True);print('PASS private baseline and pre-update demo session captured; original Status Page not changed');return
 expected=os.environ.get('KUMAEDGE_REVIEWED_SHA') or subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip();evidence=json.loads((r/'.local-release'/expected/'evidence.json').read_text());digest=evidence['images']['main']['digest']
 for _ in range(300):
  app=api('/mc/apps/E2quWe26NmOfL7q');overview=api('/mc/apps/E2quWe26NmOfL7q/overview');pods=[p for reg in overview['regions'] for p in reg['pods']]
  if app['status']=='active' and len(pods)==1 and pods[0]['status']=='ready' and all(c['imageTag']==expected for c in app['containerTemplates']) and all(c['image'].endswith('@'+digest) for c in pods[0]['containers']):break
  time.sleep(2)
 else:raise RuntimeError('Approved premium image did not become ready')
 old_path=d/'v0201-pre-update-demo-cookie.private';report=demo(expected_premium=True,old=old_path.read_text() if old_path.exists() else None)
 if report['staleSessionAfterRestart']!='PASS':raise RuntimeError('Pre-update session invalidation was not verified')
 subprocess.run(['python3',str(r/'scripts/local/bunny-full-backup.py')],check=True);before=json.loads((d/'v0201-config-baseline.private.json').read_text());after=config_snapshot()
 if before.get('ownerAuthHash')!=after['ownerAuthHash']:raise RuntimeError('Original owner password/TOTP configuration changed; no PASS')
 if before['tables']!=after['tables']:raise RuntimeError('Original monitor/Status Page configuration differs from pre-update snapshot; no PASS')
 volumes=api('/mc/apps/E2quWe26NmOfL7q/volumes')['items'];assert len(volumes)==1 and volumes[0]['id']=='117a1d40-18e4-4041-b8f7-57e2603cd32a';assert [v['id'] for v in volumes[0]['volumeInstances']]==['db5c6016-d098-4851-9253-cb2eb581357c']
 owner={'gatewayAndSocketIsolation':'PASS','passwordAndTOTPConfiguration':'PASS_UNCHANGED_ENCRYPTED_SNAPSHOT_COMPARISON','interactiveAdminTOTPLogin':'NOT_RETESTED_LOCAL_KEYCHAIN_FACTOR_DIFFERS'};result={'version':'0.20.1','sha':expected,'scope':'ACTUAL_BUNNY','owner':owner,'demo':report,'originalStatusPageAndMonitorConfiguration':'PASS_UNCHANGED','sameVolumeAndInstance':'PASS','BUNNY_SOURCE_FULL_BACKUP':'PASS','LOCAL_ISOLATED_RESTORE':'PASS','newPaidResources':0,'readiness':'DEMO_READY','externalNotifications':'NOT_VERIFIED_NO_CHANNEL'}
 (d/'v0201-live-acceptance.json').write_text(json.dumps(result,indent=2));old_path.unlink(missing_ok=True);print(json.dumps(result,indent=2))
if __name__=='__main__':main()
