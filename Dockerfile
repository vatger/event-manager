# ===============================
# 1. Dependencies
# ===============================
FROM node:20-slim AS deps
WORKDIR /app

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

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate
RUN npm run build

# ===============================
# 3. Runtime
# ===============================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Standalone Output
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

# Prisma Schema
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma

# Prisma Dependencies (aus builder, wo sie generiert wurden!)
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Start Script
COPY --chown=nextjs:nextjs start.sh ./
RUN chmod +x start.sh

USER nextjs
EXPOSE 8000

CMD ["./start.sh"]