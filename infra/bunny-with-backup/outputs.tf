output "app_id" {
  description = "Bunny Magic Containers App ID. Use as BUNNY_MC_APP_ID in GitHub Actions."
  value       = bunnynet_compute_container_app.kumaedge.id
}

output "release_image" {
  description = "Immutable published image configured at provisioning time."
  value       = "ghcr.io/${var.image_namespace}/${var.image_name}:${var.image_tag}"
}

output "next_steps" {
  description = "Post-provision live security acceptance is mandatory."
  value       = "Inspect Bunny app endpoints; disable caching of authenticated/API traffic; validate HTTPS, WebSocket, 2FA, database durability and alerts."
}
