/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? 'admin@garymayhua.com').toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'CambiarEnProduccion123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName: 'Administrador',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Seed completado');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
