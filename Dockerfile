FROM node:20-alpine AS builder

# ---- Install packages required for Canvas ----
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    libpng-dev \
    freetype-dev


WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Next.js Build
RUN npm run build

# Build artefacts are located in .next/standalone
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output

# ---- RUNNER ----
FROM node:20-alpine

# Install required packages for canvas and fonts
RUN apk add --no-cache \
  cairo \
  pango \
  jpeg \
  giflib \
  libpng \
  freetype \
  fontconfig \
  font-misc-misc \
  ttf-dejavu \
  font-noto \
  && fc-cache -f
  
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

ENV PORT=8000
ENV HOSTNAME=0.0.0.0

# Port and start command
EXPOSE 8000
CMD ["node", "server.js"]