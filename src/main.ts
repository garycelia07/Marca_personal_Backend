import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  app.use(
    helmet({
     
      // con `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` (imagenes/videos públicos).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gary Mayhua Platform API')
    .setDescription(
      'API del sitio institucional + LMS de Gary Mayhua. Incluye landing público (contenido, leads, cursos publicados) ' +
        'y panel privado (gestión de estudiantes, cursos, materiales PDF, inscripciones). ' +
        'Los endpoints marcados con el candado requieren header `Authorization: Bearer <token>` obtenido en /auth/login.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Pegar el accessToken devuelto por POST /auth/login (sin el prefijo "Bearer ")',
      },
      'access-token',
    )
    .addTag('auth', 'Login y emisión de token')
    .addTag('students', 'Gestión de estudiantes y su vigencia de acceso (admin)')
    .addTag('courses', 'Cursos, módulos y lecciones')
    .addTag('materials', 'Subida/gestión de PDFs e imágenes en el disco del VPS')
    .addTag('enrollments', 'Asignación de cursos a estudiantes y su vigencia')
    .addTag('content', 'CMS del landing público (Hero, Nosotros, Historia, Proyectos, Servicios, Redes)')
    .addTag('leads', 'Contactos entrantes (WhatsApp / formulario)')
    .addTag('health', 'Healthcheck')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Documentación Swagger en http://localhost:${port}/api/docs`);
}
bootstrap();
