# Basis-Image
FROM node:18-alpine

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

# Port und Startbefehl
EXPOSE 8000
CMD ["npm", "start"]