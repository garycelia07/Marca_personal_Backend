import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [EnrollmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EnrollmentsService);
  });

  describe('assertActiveAccess', () => {
    it('lanza 404 si el estudiante no tiene inscripción a ese curso', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.assertActiveAccess('user-1', 'course-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('permite el acceso si no hay expiresAt (vigencia indefinida para ese curso)', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
        courseId: 'course-1',
        expiresAt: null,
        progressPercent: 0,
        createdAt: new Date(),
      } as any);

      await expect(service.assertActiveAccess('user-1', 'course-1')).resolves.toBeUndefined();
    });

    it('permite el acceso si expiresAt todavía no vence', async () => {
      const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
        courseId: 'course-1',
        expiresAt: mañana,
        progressPercent: 0,
        createdAt: new Date(),
      } as any);

      await expect(service.assertActiveAccess('user-1', 'course-1')).resolves.toBeUndefined();
    });

    it('bloquea con 403 si la vigencia del curso puntual ya venció, aunque el usuario global no haya vencido', async () => {
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
        courseId: 'course-1',
        expiresAt: ayer,
        progressPercent: 0,
        createdAt: new Date(),
      } as any);

      await expect(service.assertActiveAccess('user-1', 'course-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateExpiration', () => {
    it('lanza 404 si la inscripción no existe', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(service.updateExpiration('no-existe', null)).rejects.toThrow(NotFoundException);
    });

    it('actualiza la fecha de expiración', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' } as any);
      prisma.enrollment.update.mockResolvedValue({ id: 'e1' } as any);

      await service.updateExpiration('e1', '2027-01-01T00:00:00.000Z');

      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { expiresAt: new Date('2027-01-01T00:00:00.000Z') },
      });
    });
  });
});
