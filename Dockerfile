# Build stage: compile the API and the client
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
RUN npm run build

# Runtime stage: compiled API plus the built client it serves
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=/data/logiroute.db
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
WORKDIR /app/server
CMD ["node", "dist/server/src/index.js"]
