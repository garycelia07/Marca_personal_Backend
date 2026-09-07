import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async runExpirationAlerts(): Promise<{ notified: number }> {
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const range = { gte: now, lte: soon };

    const [users, enrollments] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.STUDENT, accessExpiresAt: range, isActive: true },
        select: { email: true, fullName: true, accessExpiresAt: true },
      }),
      this.prisma.enrollment.findMany({
        where: { expiresAt: range },
        include: { user: { select: { email: true, fullName: true } } },
      }),
    ]);

    let notified = 0;

    for (const user of users) {
      await this.mail.sendCustomEmail({
        to: user.email,
        subject: 'Tu acceso vence pronto',
        body: `Hola ${user.fullName}, tu acceso a la plataforma vence el ${user.accessExpiresAt?.toISOString()}. Si deseas renovarlo contacta al administrador.`,
      });
      notified += 1;
    }

    for (const enrollment of enrollments) {
      await this.mail.sendCustomEmail({
        to: enrollment.user.email,
        subject: 'Tu curso vence pronto',
        body: `Hola ${enrollment.user.fullName}, tu acceso al curso vence el ${enrollment.expiresAt?.toISOString()}. Si deseas renovarlo contacta al administrador.`,
      });
      notified += 1;
    }

    return { notified };
  }
}