# ===============================
# 1. Dependencies Stage (Production only)
# ===============================
FROM node:20-slim AS deps
WORKDIR /app

# System dependencies für Prisma + Sharp
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Package files + Prisma Schema
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY scripts ./scripts

# Production Dependencies installieren
RUN npm ci --omit=dev --ignore-scripts && \
npm install -g tsx

# Prisma Client generieren
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate

# Sharp rebuild für Production
RUN npm rebuild sharp

# ===============================
# 2. Build Stage (mit ALLEN Dependencies)
# ===============================
FROM node:20-slim AS builder
WORKDIR /app

# Build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Package files
COPY package.json package-lock.json ./

# ALLE Dependencies (inkl. devDependencies für Build)
RUN npm ci

# Source code
COPY . .

# Prisma generieren + Next.js bauen
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate
RUN npm run build

# ===============================
# 3. Runtime Stage (Production)
# ===============================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# User setup
RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Next.js Standalone Output
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# Prisma Schema + Config
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts
#Scripts
COPY --from=builder /app/scripts ./scripts

# ALLE Production node_modules (aus deps stage)
# Dies enthält: Prisma, Sharp, Satori, dotenv, valibot, tsx, etc.
COPY --from=deps --chown=nextjs:nextjs /app/node_modules ./node_modules

# Start Script
COPY --chown=nextjs:nextjs start.sh ./
RUN chmod +x start.sh

USER nextjs

EXPOSE 8000

CMD ["./start.sh"]