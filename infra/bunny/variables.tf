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

variable "enable_sqlite_offsite_backup" {
  description = "Opt-in scheduled, encrypted, SQLite-only backup sidecar. Never backs up other app data."
  type        = bool
  default     = false
}

variable "backup_storage_zone" {
  description = "Existing private Bunny Storage Zone for encrypted backups (no Pull Zone)."
  type        = string
  default     = ""
}

variable "backup_storage_access_key" {
  description = "Existing Storage Zone write password, NOT account API key; stored in sensitive Terraform state."
  type        = string
  sensitive   = true
  default     = ""
}

variable "backup_storage_region" {
  description = "Primary region of the existing Bunny Storage Zone."
  type        = string
  default     = "de"
  validation {
    condition = contains(["de","ny","la","sg","syd","jh","uk","se"], var.backup_storage_region)
    error_message = "Choose a documented Bunny Storage region."
  }
}

variable "backup_age_recipient" {
  description = "age public recipient; private identity must be stored offline."
  type        = string
  default     = ""
}

variable "backup_interval_hours" {
  description = "Interval between completed SQLite snapshot attempts."
  type        = number
  default     = 24
  validation {
    condition = floor(var.backup_interval_hours) == var.backup_interval_hours && var.backup_interval_hours >= 6 && var.backup_interval_hours <= 168
    error_message = "Use an integer between 6 and 168."
  }
}
