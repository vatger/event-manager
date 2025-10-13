# Basis-Image
FROM node:18-alpine AS builder

# Arbeitsverzeichnis
WORKDIR /app

# Dependencies installieren
COPY package.json package-lock.json ./
RUN npm install

# App-Code kopieren
COPY . .

# Prisma-Schema kopieren und Client generieren
COPY prisma ./prisma
RUN npx prisma generate

# Next.js Build
RUN npm run build

# Build artefacts are located in .next/standalone
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output

FROM node:18-alpine

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