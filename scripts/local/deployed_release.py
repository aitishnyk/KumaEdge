"""Resolve operator runtime from verified deployed evidence, not a later docs commit."""
import json,re

def verify_deployed_release(app, evidence):
    containers = app.get('containerTemplates', [])
    if len(containers) != 2 or {c.get('name') for c in containers} != {'kumaedge', 'owner-gateway'}:
        raise ValueError('Unexpected existing deployment inventory')
    sha = evidence.get('sha', '')
    digest = evidence.get('images', {}).get('main', {}).get('digest', '')
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
        raise ValueError('Invalid deployed release evidence')
    if any(c.get('imageTag') != sha or c.get('imageDigest') != digest for c in containers):
        raise ValueError('Deployed images differ from published evidence')
    return sha

def deployed_release(root, app):
    tags = {c.get('imageTag') for c in app.get('containerTemplates', [])}
    if len(tags) != 1:
        raise ValueError('Mixed deployment revisions')
    sha = tags.pop()
    if not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid deployed source revision')
    evidence = json.loads((root / '.local-release' / sha / 'evidence.json').read_text())
    return verify_deployed_release(app, evidence)
