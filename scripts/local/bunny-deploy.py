#!/usr/bin/env python3
"""Local private Terraform plan/apply; paid apply requires the human at a TTY."""
import hashlib,json,os,pathlib,shutil,subprocess,sys
from deployment_guard import validate_plan
os.umask(0o077)
root=pathlib.Path(__file__).resolve().parents[2]
def run(*args,**kw):return subprocess.check_output(args,cwd=root,text=True,**kw).strip()
sha=run('git','rev-parse','HEAD'); directory=root/'.local-release'/sha
evidence=json.loads((directory/'evidence.json').read_text())
if evidence.get('sha')!=sha:raise SystemExit('Published evidence/source mismatch')
subprocess.run(['python3','scripts/local/evidence.py','verify'],cwd=root,check=True)
verify_env=dict(os.environ,IMAGE_TAG=sha,GITHUB_REPOSITORY='aitishnyk/kumaedge')
subprocess.run(['node','scripts/oci-release-evidence.mjs','verify',str(directory/'evidence.json')],cwd=root,env=verify_env,check=True)
# Registry credentials stay in process memory and sensitive Terraform state.
config=json.loads((pathlib.Path.home()/'.docker/config.json').read_text())
helper=config.get('credHelpers',{}).get('ghcr.io',config.get('credsStore'))
if not helper or not helper.replace('-','').isalnum():raise SystemExit('Local registry helper required')
exe=shutil.which('docker-credential-'+helper)
if not exe:raise SystemExit('Local registry helper unavailable')
r=subprocess.run([exe,'get'],input='ghcr.io\n',text=True,capture_output=True,timeout=30)
if r.returncode:raise SystemExit('Local registry credentials unavailable')
registry=json.loads(r.stdout)
key=os.environ.get('BUNNYNET_API_KEY')
if not key:
    for p in [pathlib.Path(os.environ.get('XDG_CONFIG_HOME',str(pathlib.Path.home()/'.config')))/'bunnynet.json',pathlib.Path.home()/'.bunnynet.json']:
        if p.exists():
            key=json.loads(p.read_text()).get('profiles',{}).get('default',{}).get('api_key')
            if key:break
if not key:raise SystemExit('Authenticate Bunny CLI locally; never paste the account key in chat')
deployment_id=os.environ.get('KUMAEDGE_DEPLOYMENT_ID','E2quWe26NmOfL7q')
if not deployment_id.isalnum():raise SystemExit('Invalid deployment ID')
deployment=root/'.local-deployments'/deployment_id
state=deployment/'terraform.tfstate'
if not state.exists():raise SystemExit('Reconcile existing private deployment state before planning')
password_path=deployment/'owner-gateway-password.private'
if not password_path.exists():raise SystemExit('Existing owner password is required; refusing rotation')
password_path.chmod(0o600)
env=dict(os.environ)
for name in ['TF_LOG','TF_LOG_PATH']:env.pop(name,None)
env.update(BUNNYNET_API_KEY=key,TF_VAR_ghcr_username=registry['Username'],TF_VAR_ghcr_read_token=registry['Secret'],TF_VAR_image_tag=sha,TF_VAR_image_digest=evidence['images']['main']['digest'],TF_VAR_front_door_password=password_path.read_text(),TF_VAR_region='DE',TF_VAR_volume_gb='5')
demo_path=deployment/'demo.private.json'
if demo_path.exists():env['TF_VAR_demo_environment']=demo_path.read_text()
registry.clear();key=None
apps=json.loads(run('bunny','api','GET','/mc/apps'))
if not isinstance(apps,dict) or apps.get('cursor'):raise SystemExit('Complete app reconciliation required')
# State belongs to the deployment, never the source revision.
existing=[a for a in apps.get('items',[]) if 'kuma' in a.get('name','').lower()]
if existing and not state.exists():raise SystemExit('Existing Kuma app detected; import/reconcile private Terraform state first')
state_data=json.loads(state.read_text())
app_ids=[i['attributes']['id'] for r in state_data.get('resources',[]) if r['type']=='bunnynet_compute_container_app' for i in r['instances']]
if app_ids!=[deployment_id]:raise SystemExit('Deployment state identity mismatch')

def live_identity():
    app=json.loads(run('bunny','api','GET','/mc/apps/'+deployment_id))
    volumes=json.loads(run('bunny','api','GET','/mc/apps/'+deployment_id+'/volumes'))
    endpoints=[e for c in app['containerTemplates'] for e in c.get('endpoints',[])]
    if len(app['containerTemplates'])!=2 or {c['name'] for c in app['containerTemplates']}!={'kumaedge','owner-gateway'}:raise SystemExit('Live container inventory changed')
    if len(endpoints)!=1 or endpoints[0]['id']!='E2quWe26NmOfL7q-web-xlcFG4JU0d' or str(endpoints[0]['pullZoneId'])!='6868097' or endpoints[0]['publicHost']!='mc-b4n2u1709h.bunny.run':raise SystemExit('Existing endpoint/Pull Zone identity changed')
    items=volumes['items']
    if len(items)!=1 or items[0]['id']!='117a1d40-18e4-4041-b8f7-57e2603cd32a' or items[0]['size']!=5:raise SystemExit('Existing volume identity/size changed')
    if app['autoScaling']!={'min':1,'max':1} or app['regionSettings']['allowedRegionIds']!=['DE'] or app['regionSettings']['requiredRegionIds']!=['DE']:raise SystemExit('Existing placement/replica policy changed')
    config={k:app[k] for k in ['id','name','runtimeType','regionSettings','containerTemplates','volumes','autoScaling','networkSettings','displayEndpoint']}
    return hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()

module=root/'infra/bunny';plan=directory/'bunny.tfplan';log=directory/'bunny-plan.private.log'
def terraform(*args,output=None):
    result=subprocess.run(['terraform','-chdir='+str(module),*args],env=env,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if output:output.write_text(result.stdout)
    if result.returncode:raise SystemExit('Terraform failed; inspect private local diagnostic file' if output else 'Terraform failed')
    return result.stdout
terraform('init','-reconfigure','-input=false','-backend-config=path='+str(state),output=directory/'bunny-deploy-init.private.log')
if sys.argv[1]=='plan':
    live_config_hash=live_identity()
    terraform('plan','-input=false','-no-color','-out='+str(plan),output=log)
    data=json.loads(terraform('show','-json',str(plan)))
    try:changed_fields=validate_plan(data,deployment_id,sha,evidence['images']['main']['digest'])
    except ValueError as error:plan.unlink();raise SystemExit(str(error))
    summary={'sha':sha,'plan_sha256':hashlib.sha256(plan.read_bytes()).hexdigest(),'region':'DE','volume_gb':5,'resources':[{ 'address':c['address'],'actions':c['change']['actions']} for c in data.get('resource_changes',[])], 'cost_scenario_usd_month':5.61,'cost_assumptions':'730h at sustained 0.1 CPU and 1GB total RAM + 5GB volume; CDN traffic, overhead and taxes extra; not a spending cap','endpoint':'CDN HTTPS -> protected owner gateway :3002 -> original Kuma :3001','apply':'NOT_RUN','allowed_changed_fields':changed_fields,'new_paid_resources':0,'live_config_sha256':live_config_hash,'deployment_id':deployment_id,'state_sha256':hashlib.sha256(state.read_bytes()).hexdigest()}
    (directory/'bunny-plan-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2));print('Private full plan:',log)
else:
    if not sys.stdin.isatty():raise SystemExit('Human confirmation in trusted terminal required')
    summary=json.loads((directory/'bunny-plan-summary.json').read_text())
    if hashlib.sha256(plan.read_bytes()).hexdigest()!=summary['plan_sha256']:raise SystemExit('Reviewed plan changed')
    if hashlib.sha256(state.read_bytes()).hexdigest()!=summary['state_sha256']:raise SystemExit('State changed; generate a new reviewed plan')
    if live_identity()!=summary['live_config_sha256']:raise SystemExit('Live configuration changed after plan; re-plan required')
    receipt=deployment/'live-backup-restore-receipt.private.json'
    if not receipt.exists():raise SystemExit('Verified full Bunny-source backup and local isolated restore receipt required before updating')
    backup=json.loads(receipt.read_text())
    if backup.get('app_id')!=deployment_id or backup.get('BUNNY_SOURCE_FULL_BACKUP')!='PASS' or backup.get('LOCAL_ISOLATED_RESTORE')!='PASS':raise SystemExit('Bunny backup/restore gate is not PASS')
    archive=pathlib.Path(backup.get('encrypted_archive',''))
    if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest()!=backup.get('sha256'):raise SystemExit('Backup archive missing or changed')
    print(log.read_text());print(json.dumps(summary,indent=2))
    print('PAID resources. CPU $0.02/core-hour consumed; RAM $0.005/GB-hour; volume $0.10/GB/month. CDN traffic and taxes additional. No fixed spending cap.')
    confirmation=input('Type APPLY PAID KUMAEDGE '+sha[:12]+' to authorize this exact plan: ')
    if confirmation!='APPLY PAID KUMAEDGE '+sha[:12]:raise SystemExit('No resources applied')
    if run('git','rev-parse','HEAD')!=sha or run('git','status','--porcelain','--untracked-files=all'):raise SystemExit('Source changed during approval')
    terraform('apply','-input=false','-no-color',str(plan),output=directory/'bunny-apply.private.log')
    live_identity()
    state.chmod(0o600)
    print('Apply requested. Live TLS/cache/WebSocket, 2FA, notifications and Bunny restore remain mandatory; inspect private state and outputs.')
