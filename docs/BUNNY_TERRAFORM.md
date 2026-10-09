# Bunny provisioning without clicking through the console

This directory contains reproducible infrastructure-as-code for the **managed** KumaEdge runtime. It uses the official Bunny Terraform provider's `compute_container_app` and `compute_container_imageregistry` resources. It provisions a single-region single-replica app, a persistent 5 GB default volume at `/app/data`, and a direct Anycast endpoint on port 3001. The default intentionally avoids a shared CDN cache in front of the admin application, but does not provision TLS.

## Scope

**NOT zero-server serverless:** Magic Containers have a continuously running paid container. `terraform apply` creates billable Bunny resources. CI validates only; CI does NOT apply or destroy infrastructure.

**Prerequisites:** a Bunny account API key, a GitHub classic PAT with read-only packages permission for the relevant GHCR image, Terraform 1.5+, and a private persistent Terraform state backend or securely retained local state. Use a dedicated, access-controlled workstation or private backend. Never upload Terraform state to this public repository or unencrypted GitHub artifacts: the registry credential can be present in it.

## Provisioning steps

1. Confirm the published image exists at `ghcr.io/aitishnyk/kumaedge:<PUBLISHED_MAIN_SHA>` (or set another main-branch SHA that passed image publishing). If your image is private, the GHCR PAT must be able to pull it.
2. Copy `infra/bunny/terraform.tfvars.example` to `infra/bunny/terraform.tfvars`. Configure `ghcr_username`, desired region and **the exact `image_tag` confirmed as published by GitHub Actions**. The bundled example deliberately does not include a working tag. If using `scripts/install-bunny.sh`, it asks for the SHA interactively (or uses `TF_VAR_image_tag`).
3. Set `BUNNYNET_API_KEY` and `TF_VAR_ghcr_read_token` as private environment variables in your terminal or secure secret manager. Avoid command histories and logs. **Do not** put them in a public GitHub issue, PR, code, or chat.
4. From `infra/bunny/`, run:

   ```sh
   terraform init
   terraform fmt -check
   terraform validate
   terraform plan -out=kumaedge.tfplan
   terraform apply kumaedge.tfplan
   terraform output app_id
   ```

5. **Critical:** the Terraform module now uses Anycast as the default public endpoint to avoid a shared CDN cache. Anycast by itself does not establish HTTPS/TLS. **Do not enter admin credentials over HTTP.** Configure a trusted HTTPS-terminating front door (for example a properly hardened Bunny CDN Pull Zone with *all* authenticated, API, HTML and dynamic routes bypassing shared cache), then confirm the actual public address serves HTTPS, private/no-store responses and working Engine.IO polling/WebSocket. Bunny endpoint details and TLS depend on the live account. Never assume a passing Terraform plan provides a secure public website.
6. After configuring an HTTPS hostname, run: `node scripts/check-production.mjs --url https://your-kumaedge-host.example`. This fails closed on missing explicit private/no-store cache policy, HTTP redirects and Engine.IO failures. It does not authenticate or inspect private content.
7. Configure the GitHub Actions repository variable `BUNNY_MC_APP_ID` with the printed `app_id`, and `BUNNYNET_API_KEY` in Actions secrets for future *manually approved* image updates. Enable a protected `production` environment.
8. Open the HTTPS URL and configure Uptime Kuma. Add a monitor and alert channel. Verify an actual down/recovery incident, restart the Bunny app, ensure all data is still available, and confirm checks continue while your browser is closed.
9. Maintain encrypted/offsite backups of `/app/data`, and preserve the Terraform state. Do not run `terraform destroy` on real customer data.

## Guarantees, limitations and rollback

- One static region, exactly one replica and a persistent volume. No automatic horizontal scaling with SQLite.
- The `prevent_destroy` lifecycle rule protects the app against accidental Terraform deletion/replacement. The registry resource can still be changed, so always review the plan.
- **Existing Terraform installs:** changing an endpoint from CDN to Anycast may recreate the public endpoint and change the hostname. Review the plan and do not apply this change blindly.\n- This is a **new-install** module, not an import/migration tool for a pre-existing Magic Containers app. Do not apply it against an app you've already created manually without first properly importing it into your state.
- Switching the `image_tag` requires a successful build and acceptance; the existing manual GitHub deploy workflow updates an already-created app, so avoid simultaneously managing image tags with Terraform unless you reconcile state.
- Anycast avoids automatic content caching; HTTPS still needs to be provided separately. Sessions, security, cache rules of any added proxy, persistence after restart, and alert delivery need live acceptance. GitHub CI cannot certify them without access to your account.
- Public forks must supply their own Bunny account, registry credentials and image tags. Forking this repository does **not** grant access to the publisher's Bunny resources.

Official references:
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_app
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_imageregistry
- https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app

**Note:** A Git commit in `main` is not automatically a published container image. Only use SHA tags whose **Bunny Managed - build, test and publish** workflow on main finished successfully. The installer validates SHA syntax but cannot certify private registry visibility until Bunny pulls it.

## Release eligibility at deployment time

The production GitHub Action checks that the selected SHA belongs to `main` **and** has a completed, successful official image-publishing GitHub Actions push run. Both GHCR packages must be available before the Bunny image-update action begins. A SHA with merely passing tests or a locally built Docker image is not accepted. The installer remains interactive and requires the operator to select a previously published SHA; its syntax check is not an online provenance verification. Never place Terraform state or Bunny secrets in public CI.
