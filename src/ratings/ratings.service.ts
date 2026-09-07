import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(userId: string, courseId: string, dto: CreateRatingDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException('Debes tener acceso al curso para calificarlo');
    }

    return this.prisma.rating.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { stars: dto.stars, comment: dto.comment ?? null },
      create: {
        userId,
        courseId,
        stars: dto.stars,
        comment: dto.comment ?? null,
      },
    });
  }

  async findByCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const [ratings, aggregate] = await Promise.all([
      this.prisma.rating.findMany({
        where: { courseId },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rating.aggregate({
        where: { courseId },
        _avg: { stars: true },
        _count: { _all: true },
      }),
    ]);

    return {
      ratings: ratings.map((r) => ({
        id: r.id,
        fullName: r.user.fullName,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
      average: aggregate._avg.stars ?? 0,
      total: aggregate._count._all,
    };
  }
}