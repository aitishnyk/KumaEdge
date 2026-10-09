# The Bunny Terraform provider is official and supports managed container
# applications, persistent volumes, CDN endpoints and GitHub registries.
#
# This plan creates PAID Bunny resources on terraform apply.
# Apply only from a trusted environment with PERSISTENT, protected state.
# Never use -auto-approve in a public fork.

resource "bunnynet_compute_container_imageregistry" "ghcr" {
  registry = "GitHub"
  username = var.ghcr_username
  token    = var.ghcr_read_token
}

resource "bunnynet_compute_container_app" "kumaedge" {
  name    = var.app_name
  version = 2

  # SQLite is NOT safe with multiple concurrent writers.
  autoscaling_min     = 1
  autoscaling_max     = 1
  regions_allowed     = [var.region]
  regions_required    = [var.region]
  regions_max_allowed = 1

  container {
    name            = "kumaedge"
    image_registry  = bunnynet_compute_container_imageregistry.ghcr.id
    image_namespace = var.image_namespace
    image_name      = var.image_name
    image_tag       = var.image_tag
    image_pull_policy = "IfNotPresent"

    endpoint {
      name = "web"
      type = "CDN"

      cdn {
        origin_ssl = false
      }

      port {
        container = 3001
        protocols = ["TCP"]
      }
    }

    volumemount {
      name = "data"
      path = "/app/data"
    }
  }

  volume {
    name = "data"
    size = var.volume_gb
  }

  lifecycle {
    prevent_destroy = true

    precondition {
      condition     = var.volume_gb >= 2
      error_message = "A persistent volume is required for the KumaEdge SQLite database."
    }
  }
}
