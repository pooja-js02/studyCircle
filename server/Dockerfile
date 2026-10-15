FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# Development image: all deps, code mounted as a volume by docker compose
FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

# Production image (used by Render): runtime deps only
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
