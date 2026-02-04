# ===============================
# 1. Dependencies (Production)
# ===============================
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# NUR Production deps
RUN npm ci --omit=dev

ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate

# ===============================
# 2. Build
# ===============================
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate
RUN npm run build

# Cleanup nach Build
RUN rm -rf node_modules

# ===============================
# 3. Runtime (OPTIMIERT)
# ===============================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Standalone Output (Next.js kopiert bereits minimale deps!)
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# Prisma files
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts

# NUR die nötigen node_modules für Prisma Migrations
COPY --from=deps --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=nextjs:nextjs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nextjs /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=nextjs:nextjs /app/node_modules/.bin ./node_modules/.bin
COPY --from=deps --chown=nextjs:nextjs /app/node_modules/dotenv ./node_modules/dotenv

# Start Script
COPY --chown=nextjs:nextjs start.sh ./
RUN chmod +x start.sh

USER nextjs
EXPOSE 8000

CMD ["./start.sh"]