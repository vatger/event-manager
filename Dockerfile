# ============================================
# Build Stage
# ============================================
FROM node:20-bookworm AS builder

WORKDIR /app

# Native build deps for canvas / node-gyp
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (needed for build)
RUN npm ci

# Copy application source
COPY . .

# Generate Prisma client (dummy DB)
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build


# ============================================
# Runtime Stage - Slim & Stable
# ============================================
FROM node:20-bookworm-slim AS runner

# tini for proper signal handling
RUN apt-get update && apt-get install -y tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma (schema + config)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Discord bot & shared code
COPY --from=builder /app/discord-bot ./discord-bot
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Install ONLY runtime deps (single layer)
RUN npm install --omit=dev --no-save \
  prisma@7.2.0 \
  tsx@4.20.6 \
  dotenv@17.2.3 \
  node-cron@4.2.1 \
  discord.js@14.25.1 \
  axios@1.12.2 \
  date-fns@4.1.0 \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*

# Runtime ENV
ENV NODE_ENV=production \
    PORT=8000 \
    HOSTNAME=0.0.0.0

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
