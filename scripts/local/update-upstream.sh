#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
[[ -z "${CI:-}" ]]
gh api repos/louislam/uptime-kuma/releases/latest > "$EVIDENCE/upstream-release.json"
version="$(python3 - "$EVIDENCE/upstream-release.json" <<'PY'
import json,re,sys
r=json.load(open(sys.argv[1]))
if r['prerelease'] or r['draft'] or not re.fullmatch(r'\d+\.\d+\.\d+',r['tag_name']): raise SystemExit('Stable release required')
print(r['tag_name'])
PY
)"
docker buildx imagetools inspect "louislam/uptime-kuma:$version" > "$EVIDENCE/upstream-manifest.txt"
gh api repos/louislam/uptime-kuma/security-advisories > "$EVIDENCE/upstream-advisories.json"
gh issue list -R louislam/uptime-kuma --state open --search "$version" --limit 50 --json number,title,url > "$EVIDENCE/upstream-bugs.json"
python3 - "$EVIDENCE" <<'PY'
import json,pathlib,re,sys
p=pathlib.Path(sys.argv[1]); r=json.loads((p/'upstream-release.json').read_text())
s=(p/'upstream-manifest.txt').read_text(); d=re.findall(r'^Digest:\s+(sha256:[a-f0-9]{64})$',s,re.M)
if len(d)!=1: raise SystemExit('Ambiguous manifest digest')
print(r['body']); print('Current:',pathlib.Path('Dockerfile').read_text().split('FROM ')[1].splitlines()[0])
print('PROPOSED FROM louislam/uptime-kuma:'+r['tag_name']+'@'+d[0])
print('Review advisories and regressions before editing Dockerfile. No automatic publish or deployment.')
PY
