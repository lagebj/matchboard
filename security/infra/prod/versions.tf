terraform {
  required_version = ">= 1.10, < 2.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.83"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8.0"
    }
  }
}
