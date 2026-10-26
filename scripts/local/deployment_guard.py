"""Allow image changes and gateway demo configuration on one existing app only."""
import copy

def validate_plan(plan,app_id,sha,digest,*,engine_operations=False,allow_disposable_reset=False):
    changes=plan.get('resource_changes',[])
    expected={'bunnynet_compute_container_app.kumaedge','bunnynet_compute_container_imageregistry.ghcr'}
    if {x['address'] for x in changes}!=expected:raise ValueError('Unexpected resource inventory')
    fields=[]
    for resource in changes:
        change=resource['change']
        if change['actions'] not in [['no-op'],['update']]:raise ValueError('Create/delete/replacement forbidden')
        before=copy.deepcopy(change['before']);after=copy.deepcopy(change['after'])
        if resource['address'].endswith('.ghcr'):
            if before!=after:raise ValueError('Registry changes require separate review')
            continue
        if before.get('id')!=app_id or after.get('id')!=app_id:raise ValueError('App identity changed or unknown')
        if len(after.get('container',[]))!=2 or {c['name'] for c in after['container']}!={'kumaedge','owner-gateway'}:raise ValueError('Exactly the existing two containers required')
        for index,(old,new) in enumerate(zip(before['container'],after['container'])):
            if old['name']!=new['name']:raise ValueError('Container order/identity changed')
            # Provider 0.19.1 marks endpoint.id unknown on ANY app update. It is
            # computed metadata, not a configured replacement. Permit only that
            # single unknown; every endpoint field and Pull Zone ID stays equal.
            unknown=change.get('after_unknown',{}).get('container',[])
            for endpoint_index,(old_endpoint,new_endpoint) in enumerate(zip(old.get('endpoint',[]),new.get('endpoint',[]))):
                if new_endpoint.get('id') is None and old_endpoint.get('id'):
                    flags=unknown[index].get('endpoint',[]) if len(unknown)>index else []
                    if len(flags)<=endpoint_index or flags[endpoint_index].get('id') is not True:raise ValueError('Endpoint identity changed without provider unknown marker')
                    new_endpoint['id']=old_endpoint['id']

            for key in ['image_tag','image_digest']:
                if new[key]!=(sha if key=='image_tag' else digest):raise ValueError('Image is not the tested release')
                if old[key]!=new[key]:fields.append(old['name']+'.'+key)
                old.pop(key);new.pop(key)
            if old['name']=='kumaedge' and engine_operations:
                if new.get('command')!='node' or new.get('arguments')!='/opt/kumaedge/engine-launch.cjs':raise ValueError('Unexpected engine command')
                for key in ['command','arguments']:
                    if old.get(key)!=new.get(key):fields.append('kumaedge.'+key)
                    old.pop(key,None);new.pop(key,None)
                old_env={e['name']:e['value'] for e in old['env']};new_env={e['name']:e['value'] for e in new['env']}
                allowed={'KUMAEDGE_OPS_TOKEN','KUMAEDGE_BACKUP_RECIPIENT','KUMAEDGE_DISPOSABLE_RESET_NONCE','KUMAEDGE_RESET_TARGET_APP_ID'}
                if any(k not in allowed and old_env.get(k)!=new_env.get(k) for k in set(old_env)|set(new_env)):raise ValueError('Unexpected engine environment')
                nonce=new_env.get('KUMAEDGE_DISPOSABLE_RESET_NONCE')
                if nonce and (not allow_disposable_reset or new_env.get('KUMAEDGE_RESET_TARGET_APP_ID')!=app_id):raise ValueError('Explicit scoped disposable-data reset authorization required')
                fields.extend('kumaedge.env.'+k for k in sorted(set(old_env)|set(new_env)) if old_env.get(k)!=new_env.get(k))
                old.pop('env');new.pop('env')
            if old['name']=='owner-gateway':
                old_env={e['name']:e['value'] for e in old['env']};new_env={e['name']:e['value'] for e in new['env']}
                if old_env.get('KUMAEDGE_FRONT_DOOR_PASSWORD')!=new_env.get('KUMAEDGE_FRONT_DOOR_PASSWORD'):raise ValueError('Owner credential rotation forbidden')
                allowed={'KUMAEDGE_DEMO_PUBLIC_CREDENTIALS','KUMAEDGE_DEMO_ENABLED','KUMAEDGE_DEMO_USERNAME','KUMAEDGE_DEMO_PASSWORD_HASH','KUMAEDGE_DEMO_SESSION_SECRET','KUMAEDGE_DEMO_SESSION_TTL','KUMAEDGE_DEMO_PUBLIC_TITLE','KUMAEDGE_DEMO_STATUS_PAGE','KUMAEDGE_DEMO_SERVICES','KUMAEDGE_PUBLIC_ORIGIN'}
                if any(k not in allowed and old_env.get(k)!=new_env.get(k) for k in set(old_env)|set(new_env)):raise ValueError('Unexpected gateway environment change')
                fields.extend('owner-gateway.env.'+k for k in sorted(set(old_env)|set(new_env)) if old_env.get(k)!=new_env.get(k))
                old.pop('env');new.pop('env')
        if before!=after:raise ValueError('Unexpected app/container/volume/endpoint/region/probe change')
    return fields
