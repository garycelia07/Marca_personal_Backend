import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  create(dto: CreateCourseDto) {
    return this.prisma.course.create({ data: dto });
  }

  async findAllPublished(query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { isPublished: true } as const;

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: { modules: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.course.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findAllForAdmin(query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        orderBy: { createdAt: 'desc' },
        include: { modules: { orderBy: { order: 'asc' }, include: { lessons: true } } },
        skip,
        take,
      }),
      this.prisma.course.count(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const isAdmin = user?.role === Role.ADMIN;
    const hasAccess =
      isAdmin || (!!user && (await this.enrollmentsService.hasActiveAccess(user.sub, id)));

    const includeMaterials = isAdmin || hasAccess;

    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              ...(includeMaterials ? { include: { materials: true } } : {}),
            },
          },
        },
        ...(includeMaterials ? { materials: true } : {}),
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.course.delete({ where: { id } });
    return { success: true };
  }

  async addModule(courseId: string, dto: CreateModuleDto) {
    await this.findOne(courseId);
    return this.prisma.courseModule.create({ data: { ...dto, courseId } });
  }

  async addLesson(moduleId: string, dto: CreateLessonDto) {
    const module = await this.prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('Módulo no encontrado');

    // Máximo 20 lecciones-video por curso.
    const mods = await this.prisma.courseModule.findMany({
      where: { courseId: module.courseId },
      select: { _count: { select: { lessons: true } } },
    });
    const lessonCount = mods.reduce((sum, m) => sum + m._count.lessons, 0);
    if (lessonCount >= 20) {
      throw new BadRequestException('Un curso admite máximo 20 videos (lecciones). Elimina uno antes de agregar otro.');
    }

    return this.prisma.lesson.create({ data: { ...dto, moduleId } });
  }

  async updateLesson(lessonId: string, dto: Partial<CreateLessonDto>) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    return this.prisma.lesson.update({ where: { id: lessonId }, data: { ...(dto.title ? { title: dto.title } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}) } });
  }

  async removeLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { success: true };
  }
}
