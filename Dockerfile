# === BASE STAGE (Debian Slim) ===
FROM node:20-slim AS base
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

# Install git and openssl (Debian way)
RUN apt-get update -y && apt-get install -y openssl git ca-certificates

# Install dependencies
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
FROM node:20-slim AS runner-api
WORKDIR /app

# Install runtime dependencies (Debian way)
# Isso garante que a libssl correta esteja disponível para o Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/main"]

# === RUNNER (WEB - NGINX) ===
# Web pode continuar no Alpine pois é apenas Nginx estático
FROM nginx:alpine AS runner-web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# Configuração Customizada do Nginx para SPA (React Router)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
