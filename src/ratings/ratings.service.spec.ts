import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

describe('RatingsService', () => {
  let service: RatingsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [RatingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(RatingsService);
  });

  it('rate exige tener acceso (enrollment) al curso', async () => {
    prisma.enrollment.findUnique.mockResolvedValue(null);
    await expect(
      service.rate('user-1', 'course-1', { stars: 5, comment: 'ok' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rate crea o actualiza la calificación del curso', async () => {
    prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' } as any);
    prisma.rating.upsert.mockResolvedValue({ id: 'r1' } as any);

    const dto = { stars: 4, comment: 'Muy bueno' };
    await service.rate('user-1', 'course-1', dto);

    expect(prisma.rating.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: 'user-1', courseId: 'course-1' } },
      update: { stars: 4, comment: 'Muy bueno' },
      create: { userId: 'user-1', courseId: 'course-1', stars: 4, comment: 'Muy bueno' },
    });
  });

  it('findByCourse lanza 404 si el curso no existe', async () => {
    prisma.course.findUnique.mockResolvedValue(null);
    await expect(service.findByCourse('missing')).rejects.toThrow(NotFoundException);
  });

  it('findByCourse devuelve reseñas con promedio y total', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' } as any);
    prisma.rating.findMany.mockResolvedValue([
      { id: 'r1', user: { fullName: 'Ana' }, stars: 5, comment: null, createdAt: new Date() },
    ] as any);
    prisma.rating.aggregate.mockResolvedValue({
      _avg: { stars: 5 },
      _count: { _all: 1 },
    } as any);

    const result = await service.findByCourse('course-1');

    expect(result.total).toBe(1);
    expect(result.average).toBe(5);
    expect(result.ratings[0].fullName).toBe('Ana');
  });
});