# Kasper as a container, for Synology Container Manager (or any other Docker host).
# Built and started by docker-compose.yml. See docs/synology-nl.md.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Install the packages first, so a rebuild after a code change is fast
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# The folder for panel settings and the logbook (a Docker volume, see docker-compose.yml), owned by the app user
RUN mkdir -p /app/data && chown node:node /app/data

# Never run as root (docker-compose.yml sets the DSM user that owns the project folder)
USER node

EXPOSE 8090

# Container Manager shows the app as "unhealthy" when it stops answering
HEALTHCHECK --interval=1m --timeout=10s --start-period=30s \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8090) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
