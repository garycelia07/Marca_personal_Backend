import { Test } from '@nestjs/testing';
import { LeadChannel } from '@prisma/client';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { sendLeadNotification: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(LeadsService);
  });

  it('create guarda el lead con los datos recibidos', async () => {
    const dto = {
      name: 'María Gómez',
      phone: '+51987654321',
      message: 'Quiero información',
      channel: LeadChannel.WHATSAPP,
    };
    prisma.lead.create.mockResolvedValue({
      id: '1',
      ...dto,
      email: null,
      createdAt: new Date(),
    } as any);

    await service.create(dto);

    expect(prisma.lead.create).toHaveBeenCalledWith({ data: dto });
  });

  it('findAll ordena por fecha de creación descendente (más nuevos primero) y pagina', async () => {
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll calcula correctamente el skip para páginas posteriores a la primera', async () => {
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, limit: 20 });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.meta).toEqual({ total: 45, page: 3, limit: 20, totalPages: 3 });
  });
});
