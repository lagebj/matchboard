ARG NODE_VARIANT=24-bookworm
FROM mcr.microsoft.com/devcontainers/javascript-node:${NODE_VARIANT}

ARG OPENCODE_VERSION=1.18.8
ARG NEONCLI_VERSION=2.38.5
ARG VERCEL_VERSION=58.4.4
ARG BREVO_VERSION=2.0.1

# Security tool versions (pinned for reproducibility)
ARG SEMGREP_VERSION=1.112.0
ARG OSV_SCANNER_VERSION=1.9.2
ARG GITLEAKS_VERSION=8.22.1

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

USER node
