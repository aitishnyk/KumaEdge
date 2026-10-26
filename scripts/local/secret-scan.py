#!/usr/bin/env python3
"""Scan tracked text and image metadata for credential-shaped values; no contents printed."""
import pathlib,re,subprocess,sys
patterns=[rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{30,}',rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',rb'AGE-SECRET-KEY-[A-Z0-9]{30,}']
root=pathlib.Path(__file__).resolve().parents[2]
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).split(b'\0')
failed=False
for name in files:
    if not name:continue
    path=root/name.decode()
    if not path.is_file():continue
    content=path.read_bytes()
    if any(re.search(p,content) for p in patterns):
        print('Credential pattern in tracked path:',name.decode());failed=True
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
for image in ['kumaedge-local:'+sha,'kumaedge-backup-local:'+sha]:
    content=subprocess.check_output(['docker','history','--no-trunc',image])
    content+=subprocess.check_output(['docker','image','inspect',image])
    if any(re.search(p,content) for p in patterns):
        print('Credential pattern in image metadata:',image);failed=True
if failed:sys.exit(1)
print('PASS tracked text and image metadata credential patterns (not a complete filesystem audit)')
