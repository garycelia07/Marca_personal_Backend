import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';
import { Role } from '../common/enums/role.enum';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrisma;

  const existingStudent = {
    id: 'student-1',
    email: 'alumno@x.com',
    fullName: 'Alumno Uno',
    role: Role.STUDENT,
    isActive: true,
    accessExpiresAt: null as Date | null,
    lastLoginAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { sendAccessGranted: jest.fn().mockResolvedValue(undefined), sendCustomEmail: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('createStudent', () => {
    it('crea el estudiante con la vigencia indicada', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingStudent as any);

      const dto = {
        email: 'nuevo@x.com',
        fullName: 'Nuevo Alumno',
        password: 'ClaveSegura123',
        accessExpiresAt: '2026-12-31T23:59:59.000Z',
      };
      await service.createStudent(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.STUDENT,
            accessExpiresAt: new Date(dto.accessExpiresAt),
          }),
        }),
      );
    });

    it('crea el estudiante SIN vigencia si no se especifica (accessExpiresAt = null)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingStudent as any);

      await service.createStudent({
        email: 'nuevo@x.com',
        fullName: 'Nuevo Alumno',
        password: 'ClaveSegura123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accessExpiresAt: null }) }),
      );
    });

    it('rechaza si el correo ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue(existingStudent as any);

      await expect(
        service.createStudent({
          email: existingStudent.email,
          fullName: 'Otro',
          password: 'ClaveSegura123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('setAccessExpiration', () => {
    it('actualiza la vigencia a una fecha nueva', async () => {
      prisma.user.findUnique.mockResolvedValue(existingStudent as any);
      prisma.user.update.mockResolvedValue(existingStudent as any);

      await service.setAccessExpiration(existingStudent.id, '2027-01-01T00:00:00.000Z');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { accessExpiresAt: new Date('2027-01-01T00:00:00.000Z') },
        }),
      );
    });

    it('quita la expiración cuando se envía null', async () => {
      prisma.user.findUnique.mockResolvedValue(existingStudent as any);
      prisma.user.update.mockResolvedValue(existingStudent as any);

      await service.setAccessExpiration(existingStudent.id, null);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { accessExpiresAt: null } }),
      );
    });

    it('lanza 404 si el estudiante no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setAccessExpiration('no-existe', null)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
