#!/bin/sh
set -e

pnpm exec prisma migrate deploy

# Ejecutar el seed (compilado a JS en dist/prisma/seed.js durante el build).
# Si el seed ya se aplicó antes, el upsert es idempotente; se reintenta sin fallar.
if [ -f /app/dist/prisma/seed.js ]; then
  node /app/dist/prisma/seed.js
fi

exec node dist/main.js
