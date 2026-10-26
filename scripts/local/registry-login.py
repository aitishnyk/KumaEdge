#!/usr/bin/env python3
"""Reuse an existing local Docker credential helper without exposing credentials."""
import json,pathlib,shutil,subprocess,sys
config=json.loads((pathlib.Path.home()/'.docker/config.json').read_text())
helper=config.get('credHelpers',{}).get('ghcr.io',config.get('credsStore'))
if not helper or not helper.replace('-','').isalnum(): raise SystemExit('No supported local credential helper')
exe=shutil.which('docker-credential-'+helper)
if not exe: raise SystemExit('Docker credential helper unavailable')
r=subprocess.run([exe,'get'],input='ghcr.io\n',text=True,capture_output=True,timeout=30)
if r.returncode: raise SystemExit('GHCR credentials unavailable in local keychain')
try: credentials=json.loads(r.stdout)
except Exception: raise SystemExit('Invalid credential helper response')
if not credentials.get('Username') or not credentials.get('Secret'):raise SystemExit('Empty registry credentials')
r=subprocess.run(['docker','--config',sys.argv[1],'login','ghcr.io','--username',credentials['Username'],'--password-stdin'],input=credentials['Secret'],text=True,capture_output=True,timeout=45)
credentials.clear()
if r.returncode:raise SystemExit('GHCR login rejected; refresh the local package token privately')
print('PASS: GHCR login using local credential helper and temporary Docker config')
