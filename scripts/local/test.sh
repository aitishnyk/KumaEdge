#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
rm -f "$EVIDENCE/tests.pass" "$EVIDENCE/verified.json"
npm test > "$EVIDENCE/node.log" 2>&1
python3 -m unittest discover -s test/python -v > "$EVIDENCE/python.log" 2>&1
if grep -E 'skipped=|\.\.\. skipped' "$EVIDENCE/python.log"; then echo 'Skipped Python tests block release'; exit 1; fi
while IFS= read -r file; do bash -n "$file"; done < <(find scripts -name '*.sh' -type f)
python3 -m compileall -q scripts
for module in infra/bunny infra/bunny-with-backup; do
  terraform -chdir="$module" fmt -check -recursive
  terraform -chdir="$module" init -backend=false -input=false > "$EVIDENCE/$(basename "$module")-init.log" 2>&1
  terraform -chdir="$module" validate -no-color > "$EVIDENCE/$(basename "$module")-validate.log" 2>&1
done
require_source
printf '%s\n' "$SHA" > "$EVIDENCE/tests.pass"
