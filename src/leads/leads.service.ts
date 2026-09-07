import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateLeadDto) {
    await this.mail.sendLeadNotification({ lead: dto });
    return this.prisma.lead.create({ data: dto });
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.lead.count(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}
