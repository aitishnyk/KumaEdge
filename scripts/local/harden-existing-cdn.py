#!/usr/bin/env python3
"""Review/apply cache and TLS policy ONLY to the existing KumaEdge Pull Zone."""
import hashlib,json,os,pathlib,subprocess,sys,uuid
os.umask(0o077)
root=pathlib.Path(__file__).resolve().parents[2];app='E2quWe26NmOfL7q';zone=6868097;host='mc-b4n2u1709h.bunny.run';d=root/'.local-deployments'/app;d.mkdir(parents=True,exist_ok=True)
key=os.environ.get('BUNNYNET_API_KEY')
if not key:key=json.loads((pathlib.Path.home()/'.config/bunnynet.json').read_text())['profiles']['default']['api_key']
def api(method,route,body=None):
 args=['curl','--silent','--show-error','--fail-with-body','--max-time','45','--config','-','-X',method,'https://api.bunny.net'+route]
 config='header = "AccessKey: '+key+'"\n'
 if body is not None:config+='header = "Content-Type: application/json"\ndata = '+json.dumps(json.dumps(body))+'\n'
 r=subprocess.run(args,input=config,text=True,capture_output=True)
 if r.returncode:
  (d/'cdn-api-error.private.json').write_text(r.stdout)
  raise SystemExit('Bunny API operation failed: '+method+' '+route+' (curl '+str(r.returncode)+')')
 return json.loads(r.stdout) if r.stdout else {}
a=api('GET','/mc/apps/'+app);assert a['displayEndpoint']['address']==host
endpoints=[e for c in a['containerTemplates'] for e in c.get('endpoints',[])];assert len(endpoints)==1 and str(endpoints[0]['pullZoneId'])==str(zone)
z=api('GET','/pullzone/'+str(zone));assert z['Id']==zone and z['Name']=='mc-b4n2u1709h'
rule={'Guid':str(uuid.uuid5(uuid.NAMESPACE_URL,'https://'+host+'/kumaedge-v020-private-all')),'ActionType':3,'ActionParameter1':'0','ActionParameter2':'','ActionParameter3':'','Triggers':[{'Type':0,'PatternMatches':['*'],'PatternMatchingType':0,'Parameter1':''}],'ExtraActions':[{'ActionType':16,'ActionParameter1':'0'},{'ActionType':5,'ActionParameter1':'Cache-Control','ActionParameter2':'private, no-store, max-age=0'},{'ActionType':5,'ActionParameter1':'Strict-Transport-Security','ActionParameter2':'max-age=86400'},{'ActionType':0}],'TriggerMatchingType':0,'Description':'KumaEdge all routes: no shared cache, HTTPS, short HSTS','Enabled':True,'OrderIndex':0}
patch={'EnableSmartCache':False,'CacheControlMaxAgeOverride':0,'CacheControlPublicMaxAgeOverride':0,'CacheErrorResponses':False,'DisableCookies':False,'EnableWebSockets':True}
existing_rules=[r for r in z.get('EdgeRules',[]) if r.get('Description')==rule['Description']]
if len(existing_rules)>1:raise SystemExit('Duplicate policy rules require review')
if existing_rules:rule['Guid']=existing_rules[0]['Guid']
else:rule.pop('Guid')
summary={'app_id':app,'pullzone_id':zone,'zone_fields':{k:{'before':z.get(k),'after':v} for k,v in patch.items() if z.get(k)!=v},'edge_rule':rule,'new_paid_resources':0}
if sys.argv[1]=='plan':
 (d/'cdn-before.private.json').write_text(json.dumps(z,indent=2));(d/'cdn-review.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2));sys.exit()
review=json.loads((d/'cdn-review.json').read_text());before=json.loads((d/'cdn-before.private.json').read_text())
if z!=before:raise SystemExit('Pull Zone changed after review; regenerate diff')
if summary!=review:raise SystemExit('Reviewed CDN diff changed')
# curl verifies the real chain before HSTS is enabled. Never -k.
subprocess.run(['curl','--silent','--show-error','--max-time','20','-o',os.devnull,'https://'+host+'/'],check=True)
api('POST','/pullzone/'+str(zone),patch)
api('POST','/pullzone/'+str(zone)+'/edgerules/addOrUpdate',rule)
after=api('GET','/pullzone/'+str(zone));(d/'cdn-after.private.json').write_text(json.dumps(after,indent=2))
assert all(after[k]==v for k,v in patch.items());assert any(r['Description']==rule['Description'] and r['Enabled'] for r in after['EdgeRules'])
print('Existing Pull Zone policy updated. External cache/HTTPS/WebSocket acceptance still required.')
