import { Test } from '@nestjs/testing';
import { SystemService } from './system.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

describe('SystemService', () => {
  let service: SystemService;
  let prisma: MockPrisma;
  let mail: { sendCustomEmail: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    mail = { sendCustomEmail: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SystemService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = moduleRef.get(SystemService);
  });

  it('notifica a usuarios y cursos que vencen en los próximos 15 días', async () => {
    prisma.user.findMany.mockResolvedValue([
      { email: 'a@x.com', fullName: 'Ana', accessExpiresAt: new Date() },
    ] as any);
    prisma.enrollment.findMany.mockResolvedValue([
      {
        id: 'e1',
        expiresAt: new Date(),
        user: { email: 'b@x.com', fullName: 'Ben' },
      },
    ] as any);

    const result = await service.runExpirationAlerts();

    expect(result.notified).toBe(2);
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(2);
  });
});