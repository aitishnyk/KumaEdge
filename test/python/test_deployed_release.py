import importlib.util,pathlib,unittest
p=pathlib.Path(__file__).resolve().parents[2]/'scripts/local/deployed_release.py'
spec=importlib.util.spec_from_file_location('deployed_release',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DeployedReleaseTests(unittest.TestCase):
 def setUp(self):
  self.e={'sha':'a'*40,'images':{'main':{'digest':'sha256:'+'b'*64}}}
  self.app={'containerTemplates':[{'name':n,'imageTag':'a'*40,'imageDigest':'sha256:'+'b'*64} for n in ['kumaedge','owner-gateway']]}
 def test_verified_deployed_revision(self):self.assertEqual(m.verify_deployed_release(self.app,self.e),'a'*40)
 def test_mixed_tag_refused(self):
  self.app['containerTemplates'][0]['imageTag']='c'*40
  with self.assertRaises(ValueError):m.verify_deployed_release(self.app,self.e)
 def test_digest_mismatch_refused(self):
  self.app['containerTemplates'][0]['imageDigest']='sha256:'+'c'*64
  with self.assertRaises(ValueError):m.verify_deployed_release(self.app,self.e)
 def test_extra_container_refused(self):
  self.app['containerTemplates'].append(dict(self.app['containerTemplates'][0]))
  with self.assertRaises(ValueError):m.verify_deployed_release(self.app,self.e)
 def test_invalid_evidence_refused(self):
  self.e['sha']='../outside'
  with self.assertRaises(ValueError):m.verify_deployed_release(self.app,self.e)
