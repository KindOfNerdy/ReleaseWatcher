# --- Angular UI ---
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
RUN npm ci
COPY web/ ./web/
# angular.json writes the bundle to /app/public
RUN npm run build --workspace web

# --- Server dependencies ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
# Server dependencies only (the Angular workspace is not needed at runtime)
RUN npm ci --omit=dev --workspaces=false

# --- Runtime (TypeScript runs natively, no build step) ---
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/releasewatcher.db
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY --from=web /app/public ./public
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
