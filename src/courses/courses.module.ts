import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { LessonVideosService } from './course-videos.service';
import { CourseVideosController } from './course-videos.controller';

@Module({
  controllers: [CoursesController, CourseVideosController],
  providers: [CoursesService, LessonVideosService],
  exports: [CoursesService],
})
export class CoursesModule {}
