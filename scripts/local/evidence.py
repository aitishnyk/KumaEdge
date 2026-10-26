#!/usr/bin/env python3
"""Local evidence is an unsigned operator record, never Actions provenance."""
import datetime, hashlib, json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[2]
def run(*args):
    return subprocess.check_output(args, cwd=root, text=True).strip()
sha = run('git', 'rev-parse', 'HEAD')
directory = root / '.local-release' / sha
path = directory / 'verified.json'
def image(ref):
    d = json.loads(run('docker', 'image', 'inspect', ref))[0]
    if d['Os'] != 'linux' or d['Architecture'] != 'amd64':
        raise SystemExit('Wrong image platform')
    if d['Config']['Labels'].get('org.opencontainers.image.revision') != sha:
        raise SystemExit('Image revision mismatch')
    return d['Id']
def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
refs = {'main': 'kumaedge-local:'+sha, 'backup': 'kumaedge-backup-local:'+sha}
if sys.argv[1] == 'record':
    required = ['tests.pass', 'node.log', 'python.log', 'runtime.log', 'monitoring.log', 'tls.log', 'migration.log', 'recovery.log', 'backup-age.log', 'bunny-validate.log', 'bunny-with-backup-validate.log']
    if (directory/'tests.pass').read_text().strip() != sha:
        raise SystemExit('Tests do not match HEAD')
    d = {'schema':'kumaedge-local-release-v1', 'sha':sha, 'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'platform':'linux/amd64', 'upstream':(root/'Dockerfile').read_text().split('FROM ')[1].splitlines()[0], 'images':{k:{'local':v,'id':image(v)} for k,v in refs.items()}, 'checks':{f: {'status':'PASS','sha256':digest(directory/f)} for f in required}, 'live':'NOT_RUN'}
    path.write_text(json.dumps(d, indent=2)+'\n')
else:
    d=json.loads(path.read_text())
    if d['schema'] != 'kumaedge-local-release-v1' or d['sha'] != sha:
        raise SystemExit('Evidence/source mismatch')
    for k,v in refs.items():
        if d['images'][k]['id'] != image(v): raise SystemExit('Image changed after acceptance')
    for f,check in d['checks'].items():
        if check['status'] != 'PASS' or digest(directory/f) != check['sha256']: raise SystemExit('Acceptance log changed')
print('PASS: exact local source, images and evidence')
