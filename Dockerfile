# syntax=docker/dockerfile:1
# Bunny Managed: preserve real upstream monitor engine, SQLite, UI and notifications.
FROM louislam/uptime-kuma:2.5.7@sha256:4b95dbe7ac5343b768f8e04e3035ccd59997872b1a35ab9b0f082d2cc279070e
# Upstream-supported setting bypasses first-boot DB type selection wizard.
# Single-writer deployment uses the mounted /app/data SQLite database.
ENV UPTIME_KUMA_DB_TYPE=sqlite
COPY scripts/front-door.cjs scripts/demo-mode.cjs /opt/kumaedge/
COPY scripts/demo-assets /opt/kumaedge/demo-assets
LABEL org.opencontainers.image.title="KumaEdge Bunny Managed" \
      org.opencontainers.image.source="https://github.com/aitishnyk/KumaEdge" \
      org.opencontainers.image.licenses="MIT"
EXPOSE 3001
VOLUME ["/app/data"]
