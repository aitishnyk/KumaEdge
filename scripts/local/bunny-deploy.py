#!/usr/bin/env python3
"""Local private Terraform plan/apply; paid apply requires the human at a TTY."""
import hashlib,json,os,pathlib,secrets,shutil,subprocess,sys
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
password_path=directory/'owner-gateway-password.private'
if not password_path.exists():password_path.write_text(secrets.token_urlsafe(40))
password_path.chmod(0o600)
env=dict(os.environ)
for name in ['TF_LOG','TF_LOG_PATH']:env.pop(name,None)
env.update(BUNNYNET_API_KEY=key,TF_VAR_ghcr_username=registry['Username'],TF_VAR_ghcr_read_token=registry['Secret'],TF_VAR_image_tag=sha,TF_VAR_image_digest=evidence['images']['main']['digest'],TF_VAR_front_door_password=password_path.read_text(),TF_VAR_region='DE',TF_VAR_volume_gb='5')
registry.clear();key=None
apps=json.loads(run('bunny','api','GET','/mc/apps'))
if not isinstance(apps,dict) or apps.get('cursor'):raise SystemExit('Complete app reconciliation required')
state=directory/'terraform.tfstate'
existing=[a for a in apps.get('items',[]) if 'kuma' in a.get('name','').lower()]
if existing and not state.exists():raise SystemExit('Existing Kuma app detected; import/reconcile private Terraform state first')
module=root/'infra/bunny';plan=directory/'bunny.tfplan';log=directory/'bunny-plan.private.log'
def terraform(*args,output=None):
    result=subprocess.run(['terraform','-chdir='+str(module),*args],env=env,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if output:output.write_text(result.stdout)
    if result.returncode:raise SystemExit('Terraform failed; inspect private local diagnostic file' if output else 'Terraform failed')
    return result.stdout
if sys.argv[1]=='plan':
    terraform('init','-input=false',output=directory/'bunny-deploy-init.private.log')
    terraform('plan','-input=false','-no-color','-state='+str(state),'-out='+str(plan),output=log)
    data=json.loads(terraform('show','-json',str(plan)))
    if any('delete' in c['change']['actions'] for c in data.get('resource_changes',[])):plan.unlink();raise SystemExit('Destructive plan refused')
    summary={'sha':sha,'plan_sha256':hashlib.sha256(plan.read_bytes()).hexdigest(),'region':'DE','volume_gb':5,'resources':[{ 'address':c['address'],'actions':c['change']['actions']} for c in data.get('resource_changes',[])], 'cost_scenario_usd_month':5.61,'cost_assumptions':'730h at sustained 0.1 CPU and 1GB total RAM + 5GB volume; CDN traffic, overhead and taxes extra; not a spending cap','endpoint':'CDN HTTPS -> protected owner gateway :3002 -> original Kuma :3001','apply':'NOT_RUN'}
    (directory/'bunny-plan-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2));print('Private full plan:',log)
else:
    if not sys.stdin.isatty():raise SystemExit('Human confirmation in trusted terminal required')
    summary=json.loads((directory/'bunny-plan-summary.json').read_text())
    if hashlib.sha256(plan.read_bytes()).hexdigest()!=summary['plan_sha256']:raise SystemExit('Reviewed plan changed')
    print(log.read_text());print(json.dumps(summary,indent=2))
    print('PAID resources. CPU $0.02/core-hour consumed; RAM $0.005/GB-hour; volume $0.10/GB/month. CDN traffic and taxes additional. No fixed spending cap.')
    confirmation=input('Type APPLY PAID KUMAEDGE '+sha[:12]+' to authorize this exact plan: ')
    if confirmation!='APPLY PAID KUMAEDGE '+sha[:12]:raise SystemExit('No resources applied')
    terraform('apply','-input=false','-no-color','-state='+str(state),str(plan),output=directory/'bunny-apply.private.log')
    state.chmod(0o600)
    print('Apply requested. Live TLS/cache/WebSocket, 2FA, notifications and Bunny restore remain mandatory; inspect private state and outputs.')
