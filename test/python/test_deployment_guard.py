import copy,importlib.util,pathlib,unittest
p=pathlib.Path(__file__).resolve().parents[2]/'scripts/local/deployment_guard.py'
s=importlib.util.spec_from_file_location('guard',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class DeploymentGuardTests(unittest.TestCase):
 def plan(self):
  app={'id':'existing','volume':[{'name':'data','size':5}],'container':[{'name':'kumaedge','image_tag':'old','image_digest':'old','endpoint':[],'env':[]},{'name':'owner-gateway','image_tag':'old','image_digest':'old','endpoint':[{'id':'same','cdn':[{'pullzone_id':123}]}],'env':[{'name':'KUMAEDGE_FRONT_DOOR_PASSWORD','value':'existing-private-value'}]}]}
  after=copy.deepcopy(app)
  for c in after['container']:c.update(image_tag='sha',image_digest='digest')
  after['container'][1]['env'].append({'name':'KUMAEDGE_DEMO_ENABLED','value':'false'})
  return {'resource_changes':[{'address':'bunnynet_compute_container_app.kumaedge','change':{'actions':['update'],'before':app,'after':after}},{'address':'bunnynet_compute_container_imageregistry.ghcr','change':{'actions':['no-op'],'before':{'id':42},'after':{'id':42}}}]}
 def test_allows_only_paired_images_and_demo(self):self.assertEqual(len(m.validate_plan(self.plan(),'existing','sha','digest')),5)
 def test_nested_volume_resize_rejected(self):
  p=self.plan();p['resource_changes'][0]['change']['after']['volume'][0]['size']=6
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
 def test_new_container_rejected(self):
  p=self.plan();p['resource_changes'][0]['change']['after']['container'].append({'name':'worker'})
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
 def test_unknown_or_changed_zone_rejected(self):
  for value in [None,456]:
   p=self.plan();p['resource_changes'][0]['change']['after']['container'][1]['endpoint'][0]['cdn'][0]['pullzone_id']=value
   with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
 def test_owner_rotation_rejected(self):
  p=self.plan();p['resource_changes'][0]['change']['after']['container'][1]['env'][0]['value']='rotated'
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
 def test_replace_and_extra_resources_rejected(self):
  p=self.plan();p['resource_changes'][0]['change']['actions']=['delete','create']
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
  p=self.plan();p['resource_changes'].append({'address':'new.zone'})
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')

 def test_only_computed_endpoint_id_unknown_is_allowed(self):
  p=self.plan();c=p['resource_changes'][0]['change'];c['after']['container'][1]['endpoint'][0]['id']=None
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')
  c['after_unknown']={'container':[{}, {'endpoint':[{'id':True}]}]}
  self.assertEqual(len(m.validate_plan(p,'existing','sha','digest')),5)
  c['after']['container'][1]['endpoint'][0]['cdn'][0]['pullzone_id']=None
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest')

 def test_disposable_engine_operations_require_scoped_authorization(self):
  p=self.plan();a=p['resource_changes'][0]['change']['after']['container'][0]
  a.update(command='node',arguments='/opt/kumaedge/engine-launch.cjs',env=[{'name':'KUMAEDGE_DISPOSABLE_RESET_NONCE','value':'nonce'},{'name':'KUMAEDGE_RESET_TARGET_APP_ID','value':'existing'}])
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest',engine_operations=True)
  self.assertIn('kumaedge.command',m.validate_plan(p,'existing','sha','digest',engine_operations=True,allow_disposable_reset=True))
  a['env'][1]['value']='another-app'
  with self.assertRaises(ValueError):m.validate_plan(p,'existing','sha','digest',engine_operations=True,allow_disposable_reset=True)

 def test_public_demo_optin_allowed_without_owner_or_engine_changes(self):
  p=self.plan();p['resource_changes'][0]['change']['after']['container'][1]['env'].append({'name':'KUMAEDGE_DEMO_PUBLIC_CREDENTIALS','value':'true'})
  self.assertIn('owner-gateway.env.KUMAEDGE_DEMO_PUBLIC_CREDENTIALS',m.validate_plan(p,'existing','sha','digest'))
