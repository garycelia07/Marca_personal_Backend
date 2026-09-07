FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat && corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm prisma:generate && pnpm build && \
    pnpm exec tsc prisma/seed.ts --outDir dist --rootDir prisma --module commonjs --target ES2021 --skipLibCheck --esModuleInterop --experimentalDecorators --emitDecoratorMetadata --sourceMap false

FROM dependencies AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
