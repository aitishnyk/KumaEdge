# Bunny provisioning without clicking through the console

This directory contains reproducible infrastructure-as-code for the **managed** KumaEdge runtime. It uses the official Bunny Terraform provider's `compute_container_app` and `compute_container_imageregistry` resources. It provisions a single-region single-replica app, a persistent 5 GB default volume at `/app/data`, and a CDN endpoint on port 3001.

## Scope

**NOT zero-server serverless:** Magic Containers have a continuously running paid container. `terraform apply` creates billable Bunny resources. CI validates only; CI does NOT apply or destroy infrastructure.

**Prerequisites:** a Bunny account API key, a GitHub classic PAT with read-only packages permission for the relevant GHCR image, Terraform 1.5+, and a private persistent Terraform state backend or securely retained local state. Use a dedicated, access-controlled workstation or private backend. Never upload Terraform state to this public repository or unencrypted GitHub artifacts: the registry credential can be present in it.

## Provisioning steps

1. Confirm the published image exists at `ghcr.io/aitishnyk/kumaedge:213b2121fc88ee2a49309a82b5f9d046ca167234` (or set another main-branch SHA that passed image publishing). If your image is private, the GHCR PAT must be able to pull it.
2. Copy `infra/bunny/terraform.tfvars.example` to `infra/bunny/terraform.tfvars`. Configure `ghcr_username` and desired region.
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

5. In the Bunny console inspect the generated CDN endpoint and its caching configuration. **Disable shared caching for Uptime Kuma's authenticated routes, API and all personalized content.** Verify HTTPS and Socket.IO/WebSocket functionality before exposing login to users. A CDN endpoint alone is not proof that this is secure.
6. Configure the GitHub Actions repository variable `BUNNY_MC_APP_ID` with the printed `app_id`, and `BUNNYNET_API_KEY` in Actions secrets for future *manually approved* image updates. Enable a protected `production` environment.
7. Open the HTTPS URL and configure Uptime Kuma. Add a monitor and alert channel. Verify an actual down/recovery incident, restart the Bunny app, ensure all data is still available, and confirm checks continue while your browser is closed.
8. Maintain encrypted/offsite backups of `/app/data`, and preserve the Terraform state. Do not run `terraform destroy` on real customer data.

## Guarantees, limitations and rollback

- One static region, exactly one replica and a persistent volume. No automatic horizontal scaling with SQLite.
- The `prevent_destroy` lifecycle rule protects the app against accidental Terraform deletion/replacement. The registry resource can still be changed, so always review the plan.
- This is a **new-install** module, not an import/migration tool for a pre-existing Magic Containers app. Do not apply it against an app you've already created manually without first properly importing it into your state.
- Switching the `image_tag` requires a successful build and acceptance; the existing manual GitHub deploy workflow updates an already-created app, so avoid simultaneously managing image tags with Terraform unless you reconcile state.
- CDN sessions, security, cache rules, persistence after restart, and alert delivery need live acceptance. GitHub CI cannot certify them without access to your account.
- Public forks must supply their own Bunny account, registry credentials and image tags. Forking this repository does **not** grant access to the publisher's Bunny resources.

Official references:
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_app
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_imageregistry
- https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app
