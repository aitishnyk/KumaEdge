variable "app_name" {
  description = "Dedicated Bunny Magic Containers app name."
  type        = string
  default     = "kumaedge"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,38}$", var.app_name))
    error_message = "Use a lowercase ASCII name, 3 to 39 characters."
  }
}

variable "region" {
  description = "Single static deployment region (example: DE, NL)."
  type        = string
  default     = "DE"

  validation {
    condition     = can(regex("^[A-Z]{2,4}$", var.region))
    error_message = "Use a Bunny region code such as DE."
  }
}

variable "volume_gb" {
  description = "Persistent storage capacity in GB for SQLite and uploads."
  type        = number
  default     = 5

  validation {
    condition     = var.volume_gb >= 2 && var.volume_gb <= 500 && floor(var.volume_gb) == var.volume_gb
    error_message = "volume_gb must be an integer between 2 and 500."
  }
}

variable "ghcr_username" {
  description = "GitHub user with permission to pull the KumaEdge GHCR image."
  type        = string
}

variable "ghcr_read_token" {
  description = "GitHub token with read:packages for this image. Stored in Terraform state; secure it."
  type        = string
  sensitive   = true
}

variable "image_namespace" {
  description = "Lowercase GitHub organization or owner publishing the image."
  type        = string
  default     = "aitishnyk"
}

variable "image_name" {
  description = "GHCR image name (repository segment)."
  type        = string
  default     = "kumaedge"
}

variable "image_tag" {
  description = "Exact, previously CI-tested 40-character Git SHA of a published image."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.image_tag))
    error_message = "image_tag must be an immutable 40-character lowercase Git SHA."
  }
}
