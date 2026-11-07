# ==============================================================================
# 📜 Paper Atelier (纸境工坊) · Production Dockerfile
# Zero External Dependencies | Node.js Alpine | ~55MB Lightweight Image
# ==============================================================================

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=8080

# Create application directories and grant permissions
RUN mkdir -p /app/data /app/public/og && \
    chown -R node:node /app

# Copy application source code
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node curator_daemon.py ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node data/config.example.json ./data/config.example.json

# Copy default starter seed data if not mounted externally
COPY --chown=node:node data/articles.json ./data/articles.example.json
COPY --chown=node:node data/moments.json ./data/moments.example.json
COPY --chown=node:node data/messages.json ./data/messages.example.json

# Switch to unprivileged non-root user for security
USER node

# Expose internal listening port
EXPOSE 8080

# Volumes for persistent user data & auto-generated OG images
VOLUME ["/app/data", "/app/public/og"]

# Healthcheck to ensure Zero-Downtime auto-healing
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/status || exit 1

# Start pure-native server
CMD ["node", "server.js"]
