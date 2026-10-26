# Rollback

Retain the previous immutable image/source digest and private Terraform state before every update. Re-plan with the **existing state**, same app/volume/hostname, old verified image and matching compatible config. Review all differences and obtain owner approval before applying. Never destroy/recreate the application, replace the volume or blindly copy an old state file over current state.

If a release changed only the gateway, a compatible old gateway image may suffice. If upstream changed SQLite schema, stop the writer and restore a verified matching full-volume backup into the controlled maintenance procedure; an image downgrade alone may corrupt compatibility. The v0.20.2 engine remains original Uptime Kuma 2.5.7. Its public-credential config is incompatible with an old gateway; rollback must restore the previous DEMO verifier/mode and use a new signing secret to invalidate sessions. OWNER/admin/TOTP remain unchanged.

Test recovery locally with network isolation first. Document the actual running digest and complete HTTPS/session/monitoring checks after rollback. Historical evidence in `docs/releases/` remains immutable provenance.
