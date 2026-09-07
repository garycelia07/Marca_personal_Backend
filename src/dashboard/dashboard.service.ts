import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const totalStudents = await this.prisma.user.count({ where: { role: Role.STUDENT } });
    const activeStudents = await this.prisma.user.count({
      where: {
        role: Role.STUDENT,
        isActive: true,
        OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }],
      },
    });
    const totalCourses = await this.prisma.course.count();
    const publishedCourses = await this.prisma.course.count({ where: { isPublished: true } });
    const totalEnrollments = await this.prisma.enrollment.count();

    const progressAgg = await this.prisma.enrollment.aggregate({ _avg: { progressPercent: true } });
    const completed = await this.prisma.enrollment.count({ where: { progressPercent: { gte: 100 } } });

    const byCourse = await this.prisma.enrollment.groupBy({
      by: ['courseId'],
      _count: { _all: true },
      _avg: { progressPercent: true },
    });

    const courseIds = byCourse.map((row) => row.courseId);
    const courses =
      courseIds.length > 0
        ? await this.prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
        : [];

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
      },
      enrollments: {
        total: totalEnrollments,
      },
      progress: {
        averagePercent: progressAgg._avg.progressPercent ?? 0,
        completionRate: totalEnrollments > 0 ? Math.round((completed / totalEnrollments) * 100) : 0,
      },
      byCourse: byCourse.map((row) => ({
        courseId: row.courseId,
        title: courses.find((c) => c.id === row.courseId)?.title ?? '—',
        students: row._count._all,
        averagePercent: row._avg.progressPercent ?? 0,
      })),
    };
  }
}