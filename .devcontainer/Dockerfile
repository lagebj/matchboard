ARG NODE_VARIANT=24-bookworm
FROM mcr.microsoft.com/devcontainers/javascript-node:${NODE_VARIANT}

ARG OPENCODE_VERSION=1.18.8
ARG NEONCLI_VERSION=2.38.5
ARG VERCEL_VERSION=58.4.4
ARG BREVO_VERSION=2.0.1
ARG GITHUB_COPILOT_VERSION=latest
ARG SWAMP_VERSION=20260819.011806.0-sha.a9c7ee9a

# Security tool versions (pinned for reproducibility)
ARG SEMGREP_VERSION=1.112.0
ARG OSV_SCANNER_VERSION=1.9.2
ARG GITLEAKS_VERSION=8.22.1
ARG OPA_VERSION=1.19.1

# Pinned to match Neon's actual running version exactly (`SELECT version()` against a live Neon
# branch — see docs/development/test-architecture.md), not Debian bookworm's default (15) or
# docker-compose.yml's (18) or CI's postgres:16 service containers — those three already
# disagreed with Neon and each other before this was added; 17 is the one that matches reality.
ARG POSTGRES_VERSION=17

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
        gnupg \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Native postgresql-${POSTGRES_VERSION} server — this sandboxed devcontainer cannot run Docker
# (confirmed: no cgroup write access, unshare() returns EPERM — a hard sandbox restriction, not
# a missing package), so it can't use docker-compose.yml's local Postgres like a real
# Docker-capable devcontainer or CI can. A native server process needs no containerization at
# all and gives the same effect: near-zero-latency local Postgres for `npm run dev` and
# `npm test`, instead of a remote Neon branch. Debian bookworm's own apt repo only carries
# Postgres 15, so this adds the official PGDG apt repo to get the exact version pinned above.
# See docs/development/test-architecture.md's "cleanTestDb() performance" section and
# .devcontainer/setup-local-postgres.sh/post-create.sh/post-start.sh for setup.
RUN install -d /usr/share/postgresql-common/pgdg \
    && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
        https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends "postgresql-${POSTGRES_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

# Declared-vs-actual drift, confirmed live 2026-09-24: adding the PGDG repo above makes apt's
# dependency resolver pull in the *generic* `postgresql-client` metapackage's newest PGDG
# candidate (client 18 at time of writing) as a side effect of installing the pinned
# `postgresql-${POSTGRES_VERSION}` server package — even though nothing here ever asks for 18
# explicitly, `dpkg -l` shows `postgresql-client-18` present alongside the intended
# `postgresql-client-${POSTGRES_VERSION}`. `/usr/bin/psql` is Debian's `pg_wrapper` dispatcher
# (`postgresql-client-common`), which defaults to the HIGHEST installed client version, not the
# one this Dockerfile actually pins — so `psql --version` silently reported 18, not 17, directly
# defeating the whole point of the pin above ("match Neon's actual running version exactly").
# Force every client tool onto the pinned version explicitly rather than fight apt's dependency
# resolution: `/usr/local/bin` is earlier on $PATH than `/usr/bin` (where the `pg_wrapper`
# symlinks live) for every user in this image, so these symlinks win unconditionally.
RUN for tool in psql pg_dump pg_dumpall pg_restore pg_isready createdb dropdb; do \
        ln -sf "/usr/lib/postgresql/${POSTGRES_VERSION}/bin/${tool}" "/usr/local/bin/${tool}"; \
    done

RUN npm install --global \
        "opencode-ai@${OPENCODE_VERSION}" \
        "neonctl@${NEONCLI_VERSION}" \
        "vercel@${VERCEL_VERSION}" \
        "@getbrevo/cli@${BREVO_VERSION}" \
        "@github/copilot@${GITHUB_COPILOT_VERSION}" \
    && npm cache clean --force

# Install Semgrep via pip (official recommended method for Linux).
#
# Declared-vs-actual drift, confirmed live 2026-09-24: this line has never actually installed
# Semgrep in this image. Two compounding reasons, neither surfaced before because of the
# trailing `|| true`: (1) `pip3` itself was never installed — Debian's `python3` package doesn't
# bundle pip; that needs the separate `python3-pip` apt package, now added above. (2) even with
# pip3 present, Debian 12/bookworm marks its system Python as PEP 668 "externally managed"
# (`/usr/lib/python3.11/EXTERNALLY-MANAGED`), so a plain `pip install` refuses to touch it and
# exits non-zero — `--break-system-packages` opts back into the pre-PEP-668 behavior, appropriate
# here since this is a disposable dev image, not a shared/persistent system Python. The `|| true`
# stays: Semgrep is also installed by security.yml's own CI job independently, so a transient
# install failure here should degrade to "no local `semgrep` command" rather than fail the whole
# devcontainer build — but it must no longer be silently guaranteed to fail on a fresh build.
RUN pip3 install --no-cache-dir --break-system-packages "semgrep==${SEMGREP_VERSION}" || true

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
