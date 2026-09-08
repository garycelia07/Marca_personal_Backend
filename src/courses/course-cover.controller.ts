import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { isCloudinaryConfigured, signCloudinaryUpload } from '../config/cloudinary.util';

const FOLDER = 'course-covers';

@Controller('courses')
export class CourseCoverController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(Role.ADMIN)
  @Get(':id/cover-sign')
  async sign(@Param('id') id: string) {
    const cloud = this.config.get<{ cloudName?: string; apiKey?: string; apiSecret?: string }>('cloudinary');
    if (!cloud || !isCloudinaryConfigured(cloud)) {
      // Sin Cloudinary: el front sencillamente cae al campo pegar-URL.
      return { ok: false as const, reason: 'cloudinary-not-configured' };
    }
    const course = await this.prisma.course.findUnique({ where: { id }, select: { slug: true } });
    if (!course) {
      return { ok: false as const, reason: 'course-not-found' };
    }
    const publicId = `${FOLDER}/${course.slug}`;
    const sign = signCloudinaryUpload(
      { cloudName: cloud.cloudName!, apiKey: cloud.apiKey!, apiSecret: cloud.apiSecret! },
      publicId,
      'image',
    );
    return { ok: true as const, ...sign };
  }
}
