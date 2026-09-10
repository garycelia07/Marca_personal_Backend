import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';
import { Role } from '../common/enums/role.enum';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('getStats calcula métricas de estudiantes, cursos y progreso', async () => {
    prisma.user.count.mockResolvedValue(10);
    prisma.course.count.mockResolvedValue(3);
    prisma.enrollment.count.mockResolvedValue(5);
    prisma.enrollment.aggregate.mockResolvedValue({ _avg: { progressPercent: 40 } } as any);
    (prisma.enrollment.groupBy as any).mockResolvedValue([
      { courseId: 'c1', _count: { _all: 2 }, _avg: { progressPercent: 80 } },
    ] as any);
    prisma.course.findMany.mockResolvedValue([{ id: 'c1', title: 'Negocios' }] as any);

    const result = await service.getStats();

    expect(result.students.total).toBe(10);
    expect(result.progress.averagePercent).toBe(40);
    expect(result.byCourse[0].title).toBe('Negocios');
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: Role.STUDENT }) }),
    );
  });
});