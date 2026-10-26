#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
case "${1:-plan}" in
  plan|apply) python3 scripts/local/bunny-deploy.py "${1:-plan}" ;;
  *) echo 'Usage: deploy-bunny.sh plan|apply'; exit 2 ;;
esac
