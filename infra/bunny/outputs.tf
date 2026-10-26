output "app_id" {
  description = "Bunny Magic Containers App ID. Retain privately with deployment state."
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

output "gateway_pullzone_id" {
  description = "Auto-created CDN zone; reconcile cache disabled and WebSocket enabled before owner setup."
  value       = bunnynet_compute_container_app.kumaedge.container[1].endpoint[0].cdn[0].pullzone_id
}
