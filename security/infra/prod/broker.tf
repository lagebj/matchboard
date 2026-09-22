data "archive_file" "ai_runtime" {
  type        = "zip"
  source_dir  = "${path.module}/../../broker/runtime"
  output_path = "${path.module}/runtime-function.zip"
}

data "archive_file" "ai_enrollment" {
  type        = "zip"
  source_dir  = "${path.module}/../../broker/enrollment"
  output_path = "${path.module}/enrollment-function.zip"
}

resource "scaleway_function" "ai_runtime" {
  namespace_id = scaleway_function_namespace.ai_runtime.id

  name        = "matchboard-ai-runtime"
  description = "Matchboard AI inference broker"

  runtime = "go126"
  handler = "Handle"

  privacy     = "private"
  http_option = "redirected"

  timeout   = 10
  min_scale = 0
  max_scale = 2

  zip_file = data.archive_file.ai_runtime.output_path
  zip_hash = data.archive_file.ai_runtime.output_sha256

  deploy = true
}

resource "scaleway_function" "ai_enrollment" {
  namespace_id = scaleway_function_namespace.ai_enrollment.id

  name        = "matchboard-ai-enrollment"
  description = "Matchboard AI credential enrollment service"

  runtime = "go126"
  handler = "Handle"

  privacy     = "public"
  http_option = "redirected"

  timeout   = 10
  min_scale = 0
  max_scale = 2

  zip_file = data.archive_file.ai_enrollment.output_path
  zip_hash = data.archive_file.ai_enrollment.output_sha256

  deploy = true
}
