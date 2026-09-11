import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lecciones marcadas como vistas del usuario autenticado. */
  async listUserProgress(userId: string): Promise<string[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true },
    });
    return rows.map((r) => r.lessonId);
  }

  /** Solo marca como vista si el estudiante tiene el curso inscrito y el video terminó. */
  async markDone(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    });
    if (!lesson?.module) throw new NotFoundException('Lección no encontrada');

    const courseId = lesson.module.courseId;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException('Debes tener acceso al curso para marcar la lección como vista');
    }

    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {},
      create: { userId, lessonId },
    });
    return { lessonId, done: true };
  }

  /** Quita el visto de una lección (opcional, si el alumno la desmarca). */
  async unmark(userId: string, lessonId: string) {
    await this.prisma.lessonProgress.deleteMany({ where: { userId, lessonId } });
    return { lessonId, done: false };
  }
}
