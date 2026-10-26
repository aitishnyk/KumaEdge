# Demo configuration

Copy variable names from `.env.example`; never commit populated configuration.
For the existing deployment run `python3 scripts/local/configure-demo.py` directly
in a trusted owner terminal. It reads the new password with hidden input, derives
a salted scrypt hash and writes only the hash/configuration and a separate random
session secret to the ignored, mode-0600 deployment directory. Keep the demo
password in your password manager. It must differ from gateway/admin credentials.

| Variable | Default / meaning |
|---|---|
| KUMAEDGE_DEMO_ENABLED | false; only literal true enables the handler |
| KUMAEDGE_DEMO_USERNAME | demo |
| KUMAEDGE_DEMO_PASSWORD_HASH | required when enabled; scrypt$16384$8$1$16-byte-hex-salt$32-byte-hex-key |
| KUMAEDGE_DEMO_SESSION_SECRET | required, distinct random secret of at least 32 bytes |
| KUMAEDGE_DEMO_SESSION_TTL | 3600 seconds; allowed 60–86400 |
| KUMAEDGE_DEMO_PUBLIC_TITLE | Service health; escaped, at most 100 characters |
| KUMAEDGE_PUBLIC_ORIGIN | explicit canonical HTTPS origin, no trailing slash |
| KUMAEDGE_DEMO_STATUS_PAGE | existing public Kuma status-page slug, or blank |
| KUMAEDGE_DEMO_SERVICES | JSON array of {id: positive integer, label: public label}; at most 50 |

Example non-secret allowlist: `[{"id":1,"label":"Public website"}]`.
A service is returned only when its ID is in both this allowlist and the public
status-page groups. Private names/URLs/configuration are never copied. Blank slug
or empty allowlist produces an honest empty dashboard. Publishing a status page
itself is an owner decision; never silently declassify private monitors.

Terraform accepts only these keys in sensitive `demo_environment`. The deployment
script reads `demo.private.json` from `.local-deployments/<app-id>/`; it never uses a
source-SHA directory for deployment credentials or state. The backup-worker image
is paired release packaging and must not become a third Bunny container.

To rotate credentials, privately archive the existing configuration, rerun the
terminal helper and review the normal image/config update. A gateway restart drops
all sessions; changing the session secret also invalidates every signed cookie.
Do not expect session continuity across restarts. No fallback owner credential is
accepted for demo, and an invalid enabled configuration prevents gateway startup.
