import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { MaterialsModule } from './materials/materials.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ContentModule } from './content/content.module';
import { LeadsModule } from './leads/leads.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { RatingsModule } from './ratings/ratings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    MailModule,
    DashboardModule,
    RatingsModule,
    SystemModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    MaterialsModule,
    EnrollmentsModule,
    ContentModule,
    LeadsModule,
    HealthModule,
  ],
})
export class AppModule {}
