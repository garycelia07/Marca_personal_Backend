import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEnrollmentDto) {
    return this.prisma.enrollment.create({
      data: {
        userId: dto.userId,
        courseId: dto.courseId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async findAllForUser(userId: string, query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { userId };

    const [data, total] = await Promise.all([
      this.prisma.enrollment.findMany({ where, include: { course: true }, skip, take }),
      this.prisma.enrollment.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findAllForCourse(courseId: string, query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { courseId };

    const [data, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        include: { user: { select: { id: true, email: true, fullName: true } } },
        skip,
        take,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async assertActiveAccess(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new NotFoundException('No tienes acceso a este curso');

    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
      throw new ForbiddenException('Tu acceso a este curso ha vencido');
    }
  }

  async updateExpiration(id: string, expiresAt: string | null) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    return this.prisma.enrollment.update({
      where: { id },
      data: { expiresAt: expiresAt ? new Date(expiresAt) : null },
    });
  }

  async remove(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');
    await this.prisma.enrollment.delete({ where: { id } });
    return { success: true };
  }
}
