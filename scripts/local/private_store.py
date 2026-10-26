"""Local macOS credential helper only; values never appear in arguments or logs."""
import json,shutil,subprocess
HOST='https://mc-b4n2u1709h.bunny.run'
def credential(name,value=None,username='owner'):
 exe=shutil.which('docker-credential-osxkeychain')
 if not exe:raise RuntimeError('Local Keychain helper required')
 url=HOST+'/'+name
 payload=json.dumps({'ServerURL':url,'Username':username,'Secret':value}) if value is not None else url+'\n'
 r=subprocess.run([exe,'store' if value is not None else 'get'],input=payload,text=True,capture_output=True,timeout=30)
 if r.returncode:raise RuntimeError('Local Keychain operation failed')
 if value is None:return json.loads(r.stdout)['Secret']
 if credential(name)!=value:raise RuntimeError('Keychain read-back failed')
