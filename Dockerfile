FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SELFHOST_DATA_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/wrangler.selfhost.jsonc ./wrangler.selfhost.jsonc
COPY --from=build /app/scripts/selfhost-entrypoint.sh ./scripts/selfhost-entrypoint.sh

RUN chmod +x ./scripts/selfhost-entrypoint.sh

VOLUME ["/data"]
EXPOSE 3000

CMD ["./scripts/selfhost-entrypoint.sh"]
