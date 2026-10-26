#!/usr/bin/env python3
"""Export actual full volume through owner+capability gateway; encrypted bytes only."""
import datetime,hashlib,json,os,pathlib,sqlite3,subprocess,tempfile,urllib.parse
from private_store import credential
from deployed_release import deployed_release
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];d=r/'.local-deployments/E2quWe26NmOfL7q';backups=d/'backups';backups.mkdir(exist_ok=True);backups.chmod(0o700)
app=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q'],text=True));volumes=json.loads(subprocess.check_output(['bunny','api','GET','/mc/apps/E2quWe26NmOfL7q/volumes'],text=True))
if len(volumes['items'])!=1 or volumes['items'][0]['id']!='117a1d40-18e4-4041-b8f7-57e2603cd32a':raise SystemExit('Exact existing volume identity required')
sha=deployed_release(r,app)
archive=backups/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-full-volume.age')
password=(d/'owner-gateway-password.private').read_text();token=credential('__ops')
import base64
config='header = "Authorization: Basic '+base64.b64encode(('owner:'+password).encode()).decode()+'"\nheader = "X-KumaEdge-Ops-Token: '+token+'"\n'
q=subprocess.run(['curl','--silent','--show-error','--fail','--max-time','180','--config','-','-X','POST','-D','-','-o',str(archive),'https://mc-b4n2u1709h.bunny.run/__kumaedge/backup'],input=config,text=True,capture_output=True)
if q.returncode:
 archive.unlink(missing_ok=True);raise SystemExit('Encrypted full backup download failed; no private request diagnostics printed')
headers={}
for line in q.stdout.splitlines():
 if ':' in line:k,v=line.split(':',1);headers[k.lower()]=v.strip()
def file_digest(p):
 h=hashlib.sha256()
 with p.open('rb') as stream:
  for block in iter(lambda:stream.read(1048576),b''):h.update(block)
 return h.hexdigest()
digest=file_digest(archive)
if digest!=headers.get('x-kumaedge-backup-sha256'):raise SystemExit('Full backup checksum mismatch')
name='kumaedge-bunny-restore-'+str(os.getpid());volume=name+'-data';image='kumaedge-local:'+sha
baseline={};restored={}
def db_summary(folder):
 p=folder/'kuma.db'
 with sqlite3.connect(p.as_uri()+'?mode=ro',uri=True) as conn:
  if conn.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise RuntimeError('SQLite integrity failed')
  tables={row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
  counts={t:conn.execute('SELECT count(*) FROM "'+t+'"').fetchone()[0] for t in ['user','monitor','heartbeat','status_page','notification','setting'] if t in tables}
  # Hash complete original private configuration rows without printing or exporting them.
  row_hashes={t:hashlib.sha256(repr(conn.execute('SELECT * FROM "'+t+'" ORDER BY rowid').fetchall()).encode()).hexdigest() for t in ['user','monitor','status_page','notification'] if t in tables}
  return {'counts':counts,'private_row_hashes':row_hashes}
try:
 with tempfile.TemporaryDirectory(prefix='bunny-isolated-restore-',dir=d) as temp:
  temp=pathlib.Path(temp);temp.chmod(0o700);identity=temp/'identity';identity.write_text(credential('__backup-age-identity'));identity.chmod(0o600)
  subprocess.run(['python3',str(r/'scripts/volume-backup.py'),'verify',str(archive),str(identity)],cwd=r,check=True)
  source=temp/'verified-restore';subprocess.run(['python3',str(r/'scripts/volume-backup.py'),'restore',str(archive),str(identity),str(source)],cwd=r,env={**os.environ,'KUMAEDGE_APP_STOPPED':'yes'},check=True)
  identity.unlink();baseline=db_summary(source)
  if baseline['counts'].get('user',0)<1 or baseline['counts'].get('monitor',0)<3 or baseline['counts'].get('heartbeat',0)<1:raise RuntimeError('Expected actual live dataset missing')
  subprocess.run(['docker','volume','create',volume],check=True,stdout=subprocess.DEVNULL)
  subprocess.run(['docker','create','--name',name+'-import','--network','none','--user','0','--entrypoint','sh','-v',volume+':/volume',image,'-c','chown -R 0:0 /volume'],check=True,stdout=subprocess.DEVNULL)
  subprocess.run(['docker','cp',str(source)+'/.',name+'-import:/volume'],check=True);subprocess.run(['docker','start','-a',name+'-import'],check=True,stdout=subprocess.DEVNULL)
  subprocess.run(['docker','run','-d','--network','none','--name',name,'-v',volume+':/app/data',image],check=True,stdout=subprocess.DEVNULL)
  import time
  for _ in range(90):
   ready=subprocess.run(['docker','exec',name,'node','-e','fetch("http://127.0.0.1:3001/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   if ready.returncode==0:break
   time.sleep(1)
  else:raise RuntimeError('Isolated restored engine did not start')
  subprocess.run(['docker','stop','--time','45',name],check=True,stdout=subprocess.DEVNULL)
  after=temp/'after';after.mkdir();subprocess.run(['docker','cp',name+':/app/data/.',str(after)],check=True);restored=db_summary(after)
  for table in ['user','monitor','status_page','notification']:
   if baseline['private_row_hashes'].get(table)!=restored['private_row_hashes'].get(table):raise RuntimeError('Private configuration changed in isolated restore')
  if restored['counts'].get('heartbeat',0)<baseline['counts']['heartbeat']:raise RuntimeError('Heartbeat history lost')
  # Every non-database source asset must survive byte-for-byte.
  files=0
  for p in source.rglob('*'):
   if p.is_file() and not p.name.startswith('kuma.db'):
    other=after/p.relative_to(source)
    if not other.is_file() or file_digest(p)!=file_digest(other):raise RuntimeError('Full-volume asset preservation failed')
    files+=1
  report={'app_id':'E2quWe26NmOfL7q','volume_id':'117a1d40-18e4-4041-b8f7-57e2603cd32a','source':'ACTUAL_BUNNY_CLEANLY_STOPPED_WRITER','BUNNY_SOURCE_FULL_BACKUP':'PASS','LOCAL_ISOLATED_RESTORE':'PASS','BUNNY_TO_BUNNY_RESTORE':'NOT_RUN','encrypted_archive':str(archive),'sha256':digest,'source_counts':baseline['counts'],'restored_counts':restored['counts'],'preserved_assets':files,'network':'none','sha':sha}
  (d/'live-backup-restore-receipt.private.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='encrypted_archive'},indent=2))
finally:
 for c in [name,name+'-import']:subprocess.run(['docker','rm','-f',c],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['docker','volume','rm',volume],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
