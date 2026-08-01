ARG NODE_VARIANT=24-bookworm
FROM mcr.microsoft.com/devcontainers/javascript-node:${NODE_VARIANT}

ARG OPENCODE_VERSION=1.18.8
ARG NEONCLI_VERSION=2.38.5
ARG VERCEL_VERSION=58.4.4
ARG BREVO_VERSION=2.0.1

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

USER node
