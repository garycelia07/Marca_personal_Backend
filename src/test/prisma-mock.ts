import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';

export type MockPrisma = DeepMockProxy<PrismaService>;

export function createPrismaMock(): MockPrisma {
  return mockDeep<PrismaService>();
}
