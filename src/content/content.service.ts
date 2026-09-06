import { Injectable } from '@nestjs/common';
import { ContentSection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertContentBlockDto } from './dto/upsert-content-block.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.contentBlock.findMany();
  }

  findOne(section: ContentSection) {
    return this.prisma.contentBlock.findUnique({ where: { section } });
  }

  upsert(section: ContentSection, dto: UpsertContentBlockDto) {
    return this.prisma.contentBlock.upsert({
      where: { section },
      create: { section, data: dto.data as any },
      update: { data: dto.data as any },
    });
  }
}
