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

  # Optional sidecar shares the pod and reads the SQLite volume. No public port.
  # Opt-in only. Secrets in env blocks can be present in Terraform state.
  dynamic "container" {
    for_each = var.enable_sqlite_offsite_backup ? [1] : []
    content {
      name              = "sqlite-offsite-backup"
      image_registry    = bunnynet_compute_container_imageregistry.ghcr.id
      image_namespace   = var.image_namespace
      image_name        = "kumaedge-backup"
      image_tag         = var.image_tag
      image_pull_policy = "IfNotPresent"

      volumemount {
        name = "data"
        path = "/data"
      }
      env {
        name  = "KUMAEDGE_BACKUP_VOLUME"
        value = "/data"
      }
      env {
        name  = "KUMAEDGE_STORAGE_ZONE"
        value = var.backup_storage_zone
      }
      env {
        name  = "KUMAEDGE_STORAGE_ACCESS_KEY"
        value = var.backup_storage_access_key
      }
      env {
        name  = "KUMAEDGE_STORAGE_REGION"
        value = var.backup_storage_region
      }
      env {
        name  = "KUMAEDGE_AGE_RECIPIENT"
        value = var.backup_age_recipient
      }
      env {
        name  = "KUMAEDGE_BACKUP_INTERVAL_HOURS"
        value = tostring(var.backup_interval_hours)
      }
    }
  }

  volume {
    name = "data"
    size = var.volume_gb
  }

  lifecycle {
    precondition {
      condition = !var.enable_sqlite_offsite_backup || (
        can(regex("^[a-z0-9][a-z0-9_-]{2,63}$", var.backup_storage_zone)) &&
        length(var.backup_storage_access_key) > 0 &&
        can(regex("^age1[023456789acdefghjklmnpqrstuvwxyz]{25,130}$", var.backup_age_recipient))
      )
      error_message = "Optional backups require a private Storage Zone, write key, and valid age recipient."
    }
    prevent_destroy = true

    precondition {
      condition     = var.volume_gb >= 2
      error_message = "A persistent volume is mandatory for Uptime Kuma."
    }
  }
}
