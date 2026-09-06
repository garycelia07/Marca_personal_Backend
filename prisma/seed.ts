import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@garymayhua.com';
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'CambiarEnProduccion123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Ya existe un usuario admin con el correo ${email}, no se crea de nuevo.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      fullName: 'Administrador',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`Usuario admin creado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
