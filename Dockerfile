FROM node:20-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Copy Prisma schema and generate client
COPY prisma ./prisma
# Dummy DATABASE_URL for Prisma Client generation
ENV DATABASE_URL="mysql://user:pass@localhost:3306/dummy"
RUN npx prisma generate

# Next.js Build
RUN npm run build

# Build artefacts are located in .next/standalone
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output

# ---- RUNNER ----
FROM node:20-bookworm-slim AS runner
  
WORKDIR /app

# Install Prisma CLI and tsx globally for running migrations and Discord bot
# tsx is required to run Discord bot TypeScript files
RUN npm install -g prisma tsx

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/discord-bot ./discord-bot
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./

# Install dotenv locally AFTER copying standalone build
# This ensures dotenv is available for prisma.config.ts
# Global packages can't share dependencies, so we need dotenv in local node_modules
RUN npm install --no-save dotenv

ENV PORT=8000
ENV HOSTNAME=0.0.0.0

# Port and start command
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]