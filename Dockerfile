FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

ENV NODE_ENV=production
ENV CLOUD_MODE=true

CMD ["npm", "run", "worker"]
