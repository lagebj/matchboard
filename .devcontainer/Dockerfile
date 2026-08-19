ARG NODE_VARIANT=24-bookworm
FROM mcr.microsoft.com/devcontainers/javascript-node:${NODE_VARIANT}

ARG OPENCODE_VERSION=1.18.8
ARG NEONCLI_VERSION=2.38.5
ARG VERCEL_VERSION=58.4.4
ARG BREVO_VERSION=2.0.1
ARG SWAMP_VERSION=20260819.011806.0-sha.a9c7ee9a

# Security tool versions (pinned for reproducibility)
ARG SEMGREP_VERSION=1.112.0
ARG OSV_SCANNER_VERSION=1.9.2
ARG GITLEAKS_VERSION=8.22.1
ARG OPA_VERSION=1.19.1

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        jq \
        lsof \
        postgresql-client \
        procps \
        ripgrep \
        dnsutils \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global \
        "opencode-ai@${OPENCODE_VERSION}" \
        "neonctl@${NEONCLI_VERSION}" \
        "vercel@${VERCEL_VERSION}" \
        "@getbrevo/cli@${BREVO_VERSION}" \
    && npm cache clean --force

# Install Semgrep via pip (official recommended method for Linux)
RUN pip3 install --no-cache-dir "semgrep==${SEMGREP_VERSION}" 2>/dev/null || true

# Install OSV-Scanner
RUN ARCH=$(dpkg --print-architecture) \
    && OSV_ARCH="${ARCH}" \
    && if [ "$ARCH" = "amd64" ]; then OSV_ARCH="x86_64"; fi \
    && curl -sSL "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_${OSV_ARCH}" \
        -o /usr/local/bin/osv-scanner \
    && chmod +x /usr/local/bin/osv-scanner

# Install Gitleaks
RUN ARCH=$(dpkg --print-architecture) \
    && GL_ARCH="${ARCH}" \
    && if [ "$ARCH" = "amd64" ]; then GL_ARCH="x86_64"; fi \
    && curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz" \
        | tar xz -C /usr/local/bin gitleaks \
    && chmod +x /usr/local/bin/gitleaks

# Install OPA (Open Policy Agent) — required by `npm run policy:*` (see scripts/policy-utils.mjs
# resolveOpaPath()). policies/packs/*/rego/*.rego and policies/rego/*.rego are written in Rego
# v1 syntax (migrated from v0 — see docs/arr/0020-opa-rego-v0-syntax-pinned.md), so this is
# pinned to a current 1.x release rather than the 0.x line.
RUN ARCH=$(dpkg --print-architecture) \
    && curl -sSL "https://github.com/open-policy-agent/opa/releases/download/v${OPA_VERSION}/opa_linux_${ARCH}_static" \
        -o /usr/local/bin/opa \
    && chmod +x /usr/local/bin/opa

# Install Swamp CLI (see docs/adr/0068-swamp-procedure-runner.md). Installed as root so the
# official installer's default root destination (/usr/local/bin) is used, matching the other
# tools above. Always invoke with --no-telemetry (no persistent telemetry-disable config exists).
RUN curl -fsSL https://swamp-club.com/install.sh | sh -s -- -V "${SWAMP_VERSION}"

# Claude Code managed settings: enforce Claude.ai authentication and
# isolate any inherited API credentials from reaching Claude Code.
RUN mkdir -p /etc/claude-code
COPY managed-settings.json /etc/claude-code/managed-settings.json

USER node
