import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));
import { mkdir, rm, writeFile } from 'fs/promises';

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'archivo.pdf',
    mimetype: 'application/pdf',
    size: 1234,
    buffer: Buffer.from('contenido'),
    ...overrides,
  } as Express.Multer.File;
}

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prisma: MockPrisma;

  const existingMaterial = {
    id: 'material-1',
    title: 'Folleto',
    storageKey: 'general/viejo-uuid-viejo.pdf',
    bucket: 'local',
    mimeType: 'application/pdf',
    sizeBytes: 999,
    courseId: null as string | null,
    lessonId: null as string | null,
    isPublic: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('./uploads/materials') },
        },
      ],
    }).compile();

    service = moduleRef.get(MaterialsService);
  });

  describe('upload', () => {
    it('escribe el archivo en disco y crea el registro en la base de datos', async () => {
      prisma.material.create.mockResolvedValue(existingMaterial as any);

      await service.upload({ title: 'Folleto', isPublic: true }, fakeFile());

      expect(writeFile).toHaveBeenCalledTimes(1);
      expect(prisma.material.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Folleto', isPublic: true, bucket: 'local' }),
        }),
      );
    });
  });

  describe('replace', () => {
    it('lanza 404 si el material no existe', async () => {
      prisma.material.findUnique.mockResolvedValue(null);

      await expect(service.replace('no-existe', {})).rejects.toThrow(NotFoundException);
      expect(writeFile).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });

    it('con archivo nuevo: escribe el nuevo ANTES de borrar el viejo, y actualiza la DB con la nueva storageKey', async () => {
      prisma.material.findUnique.mockResolvedValue(existingMaterial as any);
      prisma.material.update.mockResolvedValue({ ...existingMaterial, title: 'Folleto V2' } as any);

      const callOrder: string[] = [];
      (writeFile as jest.Mock).mockImplementation(async () => {
        callOrder.push('writeFile');
      });
      (rm as jest.Mock).mockImplementation(async () => {
        callOrder.push('rm');
      });

      await service.replace(
        existingMaterial.id,
        { title: 'Folleto V2' },
        fakeFile({ originalname: 'nuevo.pdf' }),
      );

      expect(callOrder).toEqual(['writeFile', 'rm']);

      const rmPathArg = (rm as jest.Mock).mock.calls[0][0] as string;
      expect(rmPathArg).toContain('viejo-uuid-viejo.pdf');

      expect(prisma.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingMaterial.id },
          data: expect.objectContaining({
            title: 'Folleto V2',
            mimeType: 'application/pdf',
          }),
        }),
      );
      const updateData = (prisma.material.update.mock.calls[0][0] as any).data;
      expect(updateData.storageKey).not.toBe(existingMaterial.storageKey);
    });

    it('sin archivo nuevo: NO toca el disco, solo actualiza metadata', async () => {
      prisma.material.findUnique.mockResolvedValue(existingMaterial as any);
      prisma.material.update.mockResolvedValue({ ...existingMaterial, isPublic: false } as any);

      await service.replace(existingMaterial.id, { isPublic: false });

      expect(writeFile).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
      expect(prisma.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storageKey: existingMaterial.storageKey, // se mantiene igual
            isPublic: false,
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('borra el archivo físico y luego el registro de la base de datos', async () => {
      prisma.material.findUnique.mockResolvedValue(existingMaterial as any);
      prisma.material.delete.mockResolvedValue(existingMaterial as any);

      const result = await service.remove(existingMaterial.id);

      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('viejo-uuid-viejo.pdf'),
        expect.objectContaining({ force: true }),
      );
      expect(prisma.material.delete).toHaveBeenCalledWith({ where: { id: existingMaterial.id } });
      expect(result).toEqual({ success: true });
    });

    it('lanza 404 si el material no existe', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
