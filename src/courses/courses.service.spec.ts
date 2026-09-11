import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';
import { EnrollmentsService } from '../enrollments/enrollments.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: MockPrisma;
  let enrollmentsService: { hasActiveAccess: jest.Mock };

  const course = {
    id: 'course-1',
    title: 'Liderazgo',
    slug: 'liderazgo',
    description: null as string | null,
    coverImageUrl: null as string | null,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    enrollmentsService = { hasActiveAccess: jest.fn().mockResolvedValue(false) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentsService, useValue: enrollmentsService },
      ],
    }).compile();
    service = moduleRef.get(CoursesService);
  });

  describe('create', () => {
    it('crea el curso con los datos del DTO', async () => {
      prisma.course.create.mockResolvedValue(course as any);
      const dto = { title: 'Liderazgo', slug: 'liderazgo' };

      const result = await service.create(dto);

      expect(prisma.course.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(course);
    });
  });

  describe('findAllPublished', () => {
    it('solo filtra por isPublished: true, y pagina', async () => {
      prisma.course.findMany.mockResolvedValue([course] as any);
      prisma.course.count.mockResolvedValue(1);

      const result = await service.findAllPublished({ page: 1, limit: 20 });

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true }, skip: 0, take: 20 }),
      );
      expect(prisma.course.count).toHaveBeenCalledWith({ where: { isPublished: true } });
      expect(result.data).toEqual([course]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('lanza 404 si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el curso con módulos/lecciones/materiales incluidos solo para admin', async () => {
      prisma.course.findUnique.mockResolvedValue(course as any);
      const result = await service.findOne(course.id, { sub: 'user-1', email: 'a@a.com', role: 'ADMIN' } as any);
      expect(result).toEqual(course);
    });

    it('no incluye materiales en el detalle público si el usuario no está inscrito', async () => {
      prisma.course.findUnique.mockResolvedValue(course as any);

      await service.findOne(course.id);

      const query: any = prisma.course.findUnique.mock.calls[0][0];
      expect(query.include).not.toHaveProperty('materials');
      expect(query.include.modules.include.lessons).not.toHaveProperty('include');
    });
  });

  describe('update', () => {
    it('lanza 404 si el curso no existe antes de intentar actualizar', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.update('no-existe', { title: 'X' })).rejects.toThrow(NotFoundException);
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('actualiza si el curso existe', async () => {
      prisma.course.findUnique.mockResolvedValue(course as any);
      prisma.course.update.mockResolvedValue({ ...course, title: 'Nuevo título' } as any);

      const result = await service.update(course.id, { title: 'Nuevo título' });

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: course.id },
        data: { title: 'Nuevo título' },
      });
      expect(result.title).toBe('Nuevo título');
    });
  });

  describe('remove', () => {
    it('lanza 404 si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
      expect(prisma.course.delete).not.toHaveBeenCalled();
    });

    it('borra el curso si existe', async () => {
      prisma.course.findUnique.mockResolvedValue(course as any);
      prisma.course.delete.mockResolvedValue(course as any);

      const result = await service.remove(course.id);

      expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: course.id } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('addModule', () => {
    it('lanza 404 si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.addModule('no-existe', { title: 'Módulo 1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('crea el módulo asociado al curso', async () => {
      prisma.course.findUnique.mockResolvedValue(course as any);
      prisma.courseModule.create.mockResolvedValue({ id: 'mod-1' } as any);

      await service.addModule(course.id, { title: 'Módulo 1', order: 0 });

      expect(prisma.courseModule.create).toHaveBeenCalledWith({
        data: { title: 'Módulo 1', order: 0, courseId: course.id },
      });
    });
  });

  describe('addLesson', () => {
    it('lanza 404 si el módulo no existe', async () => {
      prisma.courseModule.findUnique.mockResolvedValue(null);
      await expect(service.addLesson('no-existe', { title: 'Lección 1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('crea la lección asociada al módulo', async () => {
      prisma.courseModule.findUnique.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' } as any);
      prisma.courseModule.findMany.mockResolvedValue([{ _count: { lessons: 0 } }] as any);
      prisma.lesson.create.mockResolvedValue({ id: 'lesson-1' } as any);

      await service.addLesson('mod-1', { title: 'Lección 1' });

      expect(prisma.lesson.create).toHaveBeenCalledWith({
        data: { title: 'Lección 1', moduleId: 'mod-1' },
      });
    });
  });
});
