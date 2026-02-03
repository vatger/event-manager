# ===============================
# 1. Dependencies
# ===============================
FROM node:20-slim AS deps

WORKDIR /app

# Prisma + Sharp Dependencies für Debian
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci


# ===============================
# 2. Build
# ===============================
FROM node:20-slim AS builder

WORKDIR /app

# Sharp build deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client (ohne DB-Zugriff!)
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate

# Next.js Standalone Build
RUN npm run build


# ===============================
# 3. Runtime
# ===============================
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root User
RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Standalone Output
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# Prisma (nur das Nötige)
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 8000

# Migrationen + App
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
