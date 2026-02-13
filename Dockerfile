# === BASE STAGE ===
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# === DEPENDENCIES ===
FROM base AS deps
COPY package.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install git (required for some dependencies)
RUN apk add --no-cache git

# Install dependencies (using npm as per project structure)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx turbo run db:generate

# === BUILDER ===
FROM deps AS builder
# Build everything
RUN npx turbo run build

# === RUNNER (API) ===
FROM node:20-alpine AS runner-api
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/main"]

# === RUNNER (WEB - NGINX) ===
FROM nginx:alpine AS runner-web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# Custom Nginx config can be added here
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
