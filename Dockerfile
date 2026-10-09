# syntax=docker/dockerfile:1
# Bunny Managed: preserve real upstream monitor engine, SQLite, UI and notifications.
FROM louislam/uptime-kuma:2@sha256:9912da7d7d9b6ddc0c2d904beb84d24689c1ed9c33b81419eb9008663a92a329
# Upstream-supported setting bypasses first-boot DB type selection wizard.
# Single-writer deployment uses the mounted /app/data SQLite database.
ENV UPTIME_KUMA_DB_TYPE=sqlite
LABEL org.opencontainers.image.title="KumaEdge Bunny Managed" \
      org.opencontainers.image.source="https://github.com/aitishnyk/KumaEdge" \
      org.opencontainers.image.licenses="MIT"
EXPOSE 3001
VOLUME ["/app/data"]
