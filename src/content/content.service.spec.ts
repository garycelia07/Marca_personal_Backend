import { Test } from '@nestjs/testing';
import { ContentSection } from '@prisma/client';
import { ContentService } from './content.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

describe('ContentService', () => {
  let service: ContentService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [ContentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ContentService);
  });

  it('findAll devuelve todos los bloques de contenido', async () => {
    prisma.contentBlock.findMany.mockResolvedValue([
      { id: '1', section: ContentSection.HERO, data: {}, updatedAt: new Date() },
    ] as any);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('findOne busca por la sección indicada', async () => {
    prisma.contentBlock.findUnique.mockResolvedValue(null);

    await service.findOne(ContentSection.ABOUT);

    expect(prisma.contentBlock.findUnique).toHaveBeenCalledWith({
      where: { section: ContentSection.ABOUT },
    });
  });

  describe('upsert', () => {
    it('crea el bloque si la sección no existía (comportamiento de upsert)', async () => {
      const data = { title: 'Los grandes sueños comienzan siendo un sueño' };
      prisma.contentBlock.upsert.mockResolvedValue({
        id: '1',
        section: ContentSection.HERO,
        data,
        updatedAt: new Date(),
      } as any);

      await service.upsert(ContentSection.HERO, { data });

      expect(prisma.contentBlock.upsert).toHaveBeenCalledWith({
        where: { section: ContentSection.HERO },
        create: { section: ContentSection.HERO, data },
        update: { data },
      });
    });

    it('reemplaza el data existente si la sección ya existía', async () => {
      const nuevaData = { title: 'Nuevo titular' };
      prisma.contentBlock.upsert.mockResolvedValue({
        id: '1',
        section: ContentSection.HERO,
        data: nuevaData,
        updatedAt: new Date(),
      } as any);

      const result = await service.upsert(ContentSection.HERO, { data: nuevaData });

      expect(result.data).toEqual(nuevaData);
    });
  });
});
