# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS base

WORKDIR /app

# Create logs directory
RUN mkdir -p logs

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source
COPY . .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Copy installed modules and app from base
COPY --from=base /app /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001  && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Lightweight health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { \
    process.exit(r.statusCode === 200 ? 0 : 1); \
  }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
