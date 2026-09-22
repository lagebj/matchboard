resource "scaleway_function_namespace" "ai_runtime" {
  name        = "matchboard-ai-runtime-prod"
  description = "Matchboard AI inference broker runtime"

  environment_variables = {
    MB_SCALEWAY_PROJECT_ID          = var.project_id
    MB_SCALEWAY_REGION              = var.region
    MB_RUNTIME_TOKEN_PUBLIC_KEY_B64 = var.runtime_token_public_key_b64
  }

  tags = [
    "application=matchboard",
    "environment=prod",
    "security-boundary=ai-credentials",
    "purpose=runtime",
  ]

  lifecycle {
    ignore_changes = [
      secret_environment_variables,
    ]
  }
}

resource "scaleway_function_namespace" "ai_enrollment" {
  name        = "matchboard-ai-enrollment-prod"
  description = "Matchboard AI credential enrollment service"

  environment_variables = {
    MB_SCALEWAY_PROJECT_ID             = var.project_id
    MB_SCALEWAY_REGION                 = var.region
    MB_SCALEWAY_SECRET_KMS_KEY_ID      = var.ai_secret_kms_key_id
    MB_ENROLLMENT_TOKEN_PUBLIC_KEY_B64 = var.enrollment_token_public_key_b64
  }

  tags = [
    "application=matchboard",
    "environment=prod",
    "security-boundary=ai-credentials",
    "purpose=enrollment",
  ]

  lifecycle {
    ignore_changes = [
      secret_environment_variables,
    ]
  }
}
