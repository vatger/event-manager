# Basis-Image
FROM node:20-bookworm AS builder

# Installiere Build-Tools für native Dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


# App-Code kopieren
COPY . .

# Prisma-Schema kopieren und Client generieren
COPY prisma ./prisma
RUN npx --package=prisma@6.19.0 prisma generate

# Next.js Build
RUN npm run build

# Build artefacts are located in .next/standalone
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output

FROM node:20-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY public ./public

ENV PORT=8000
ENV HOSTNAME=0.0.0.0

# Port und Startbefehl
EXPOSE 8000
CMD ["node", "server.js"]