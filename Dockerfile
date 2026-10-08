# syntax=docker/dockerfile:1
# Bunny Managed: preserve real upstream monitor engine, SQLite, UI and notifications.
FROM louislam/uptime-kuma:2
LABEL org.opencontainers.image.title="KumaEdge Bunny Managed" \
      org.opencontainers.image.source="https://github.com/aitishnyk/KumaEdge" \
      org.opencontainers.image.licenses="MIT"
EXPOSE 3001
VOLUME ["/app/data"]
