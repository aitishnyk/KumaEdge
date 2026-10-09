terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    bunnynet = {
      source  = "BunnyWay/bunnynet"
      version = "= 0.19.1"
    }
  }
}

provider "bunnynet" {
  # Uses BUNNYNET_API_KEY from the local environment.
  # Never embed secrets in this module.
}
