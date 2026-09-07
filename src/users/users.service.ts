import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async createStudent(dto: CreateStudentDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const student = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        role: Role.STUDENT,
        accessExpiresAt: dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null,
      },
      select: this.publicSelect(),
    });

    await this.mail.sendAccessGranted({
      to: dto.email,
      fullName: dto.fullName,
      password: dto.password,
      expiresAt: dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : undefined,
    });

    return student;
  }

  async findAllStudents(query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { role: Role.STUDENT } as const;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.publicSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: this.publicSelect() });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.accessExpiresAt !== undefined
          ? { accessExpiresAt: dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null }
          : {}),
      },
      select: this.publicSelect(),
    });
  }

  async setAccessExpiration(id: string, accessExpiresAt: string | null) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null },
      select: this.publicSelect(),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async sendEmail(id: string, subject: string, body: string) {
    const user = await this.findOne(id);
    await this.mail.sendCustomEmail({ to: user.email, subject, body });
    return { success: true };
  }

  private publicSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      accessExpiresAt: true,
      lastLoginAt: true,
      createdAt: true,
    } as const;
  }
}
