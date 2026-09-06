import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' }, include: { materials: true } } },
        },
        materials: true,
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
    return this.prisma.lesson.create({ data: { ...dto, moduleId } });
  }
}
