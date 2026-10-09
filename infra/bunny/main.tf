# Bunny Managed / Uptime Kuma: a single SQLite writer with durable volume.
# Paid infrastructure. Never apply without an explicit reviewed plan.
resource "bunnynet_compute_container_imageregistry" "ghcr" {
  registry = "GitHub"
  username = var.ghcr_username
  token    = var.ghcr_read_token
}

resource "bunnynet_compute_container_app" "kumaedge" {
  name    = var.app_name
  version = 2

  autoscaling_min     = 1
  autoscaling_max     = 1
  regions_allowed     = [var.region]
  regions_required    = [var.region]
  regions_max_allowed = 1

  container {
    name              = "kumaedge"
    image_registry    = bunnynet_compute_container_imageregistry.ghcr.id
    image_namespace   = var.image_namespace
    image_name        = var.image_name
    image_tag         = var.image_tag
    image_pull_policy = "IfNotPresent"

    # Anycast avoids an automatically configured shared CDN content cache.
    # It does not itself prove HTTPS/TLS is set up. Never use HTTP for login.
    endpoint {
      name = "web"
      type = "Anycast"

      port {
        container = 3001
        exposed   = 3001
        protocols = ["TCP"]
      }
    }

    # A health probe must not depend on having an admin login session.
    readiness_probe {
      type              = "http"
      port              = 3001
      initial_delay     = 20
      period            = 15
      timeout           = 5
      failure_threshold = 3
      http {
        path            = "/"
        expected_status = 200
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
      error_message = "A persistent volume is mandatory for Uptime Kuma."
    }
  }
}
