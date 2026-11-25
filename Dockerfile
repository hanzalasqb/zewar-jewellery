# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install
COPY . .
RUN npm run build

# API: one bundled file plus zod.
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --omit=dev --no-save zod@3
COPY --from=build /app/apps/api/dist/server.js ./server.js
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
CMD ["node", "server.js"]

# Web: static build served by nginx, proxying /api to the API.
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
