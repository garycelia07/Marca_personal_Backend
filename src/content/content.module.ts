import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentImagesService } from './content-images.service';
import { ContentImagesController } from './content-images.controller';
import { ProjectVideosService } from './project-videos.service';
import { ProjectVideosController } from './project-videos.controller';
import { ServiceCoversService } from './service-covers.service';
import { ServiceCoversController } from './service-covers.controller';

@Module({
  controllers: [
    ContentController,
    ContentImagesController,
    ProjectVideosController,
    ServiceCoversController,
  ],
  providers: [ContentService, ContentImagesService, ProjectVideosService, ServiceCoversService],
  exports: [ContentImagesService],
})
export class ContentModule {}
