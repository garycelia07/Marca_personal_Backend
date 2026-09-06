import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { ContentSection, LeadChannel } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { createPrismaMock, MockPrisma } from '../src/test/prisma-mock';
import { Role } from '../src/common/enums/role.enum';

// evita que MaterialsService toque el filesystem real en el e2e de subida
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({}),
}));

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  const adminPasswordHash = bcrypt.hashSync('ClaveAdmin123', 4);
  const adminUser = {
    id: 'admin-1',
    email: 'admin@garymayhua.com',
    passwordHash: adminPasswordHash,
    fullName: 'Administrador',
    role: Role.ADMIN,
    isActive: true,
    accessExpiresAt: null as Date | null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const studentPasswordHash = bcrypt.hashSync('ClaveAlumno123', 4);
  const expiredStudent = {
    id: 'student-1',
    email: 'alumno.vencido@x.com',
    passwordHash: studentPasswordHash,
    fullName: 'Alumno Vencido',
    role: Role.STUDENT,
    isActive: true,
    accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // ayer
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeStudent = {
    id: 'student-2',
    email: 'alumno.activo@x.com',
    passwordHash: studentPasswordHash,
    fullName: 'Alumno Activo',
    role: Role.STUDENT,
    isActive: true,
    accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // mañana
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde ok sin autenticación', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /content (público) no requiere token', async () => {
    prisma.contentBlock.findMany.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get('/api/v1/content');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /students (protegido) rechaza sin token con 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/students');
    expect(res.status).toBe(401);
  });

  it('POST /auth/login con credenciales inválidas responde 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@x.com', password: 'lo-que-sea' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/login con body inválido (sin password) responde 400 por el ValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@garymayhua.com' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login con estudiante cuya vigencia venció responde 401 (no emite token)', async () => {
    prisma.user.findUnique.mockResolvedValue(expiredStudent as any);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: expiredStudent.email, password: 'ClaveAlumno123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/vencido/i);
  });

  describe('flujo completo de admin: login -> ruta protegida', () => {
    let accessToken: string;

    beforeAll(async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser as any);
      prisma.user.update.mockResolvedValue(adminUser as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'ClaveAdmin123' });

      expect(res.status).toBe(200);
      accessToken = res.body.accessToken;
    });

    it('login exitoso devuelve un accessToken', () => {
      expect(typeof accessToken).toBe('string');
      expect(accessToken.length).toBeGreaterThan(10);
    });

    it('el token permite acceder a una ruta de admin (GET /students, paginado)', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      const res = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } });
    });

    it('un token inválido/adulterado es rechazado con 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', 'Bearer token-falso-adulterado');

      expect(res.status).toBe(401);
    });
  });

  describe('flujo de estudiante: login válido, pero bloqueado de rutas de admin', () => {
    let studentToken: string;

    beforeAll(async () => {
      prisma.user.findUnique.mockResolvedValue(activeStudent as any);
      prisma.user.update.mockResolvedValue(activeStudent as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeStudent.email, password: 'ClaveAlumno123' });

      expect(res.status).toBe(200);
      studentToken = res.body.accessToken;
    });

    it('un estudiante con vigencia vigente puede ver "mis cursos" (GET /enrollments/me, paginado)', async () => {
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.enrollment.count.mockResolvedValue(0);
      const res = await request(app.getHttpServer())
        .get('/api/v1/enrollments/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } });
    });

    it('RolesGuard bloquea a un STUDENT en una ruta de ADMIN (GET /students) con 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('RolesGuard bloquea a un STUDENT creando un curso (POST /courses) con 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Curso Pirata', slug: 'curso-pirata' });

      expect(res.status).toBe(403);
    });
  });

  describe('courses', () => {
    let adminToken: string;

    beforeAll(async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser as any);
      prisma.user.update.mockResolvedValue(adminUser as any);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'ClaveAdmin123' });
      adminToken = res.body.accessToken;
    });

    it('POST /courses (admin) crea un curso', async () => {
      const dto = { title: 'Bienes Raíces 101', slug: 'bienes-raices-101' };
      prisma.course.create.mockResolvedValue({
        id: 'course-1',
        ...dto,
        description: null,
        coverImageUrl: null,
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe(dto.slug);
    });

    it('POST /courses rechaza con 400 si falta el campo obligatorio "slug"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Curso sin slug' });

      expect(res.status).toBe(400);
    });

    it('GET /courses/:id responde 404 si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/courses/no-existe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('materials (subida a disco del VPS)', () => {
    let adminToken: string;

    beforeAll(async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser as any);
      prisma.user.update.mockResolvedValue(adminUser as any);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'ClaveAdmin123' });
      adminToken = res.body.accessToken;
    });

    it('POST /materials sube un PDF válido', async () => {
      prisma.material.create.mockResolvedValue({
        id: 'material-1',
        title: 'Brochure',
        storageKey: 'general/x-brochure.pdf',
        bucket: 'local',
        mimeType: 'application/pdf',
        sizeBytes: 4,
        courseId: null,
        lessonId: null,
        isPublic: true,
        createdAt: new Date(),
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Brochure')
        .field('isPublic', 'true')
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'brochure.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('application/pdf');
    });

    it('POST /materials rechaza un tipo de archivo no permitido (.txt) con 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Archivo malo')
        .attach('file', Buffer.from('esto es texto plano'), {
          filename: 'malo.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
    });

    it('POST /materials sin token es rechazado con 401 (aunque el archivo sea válido)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/materials')
        .field('title', 'Brochure')
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'brochure.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(401);
    });

    it('GET /materials/public no requiere token', async () => {
      prisma.material.findMany.mockResolvedValue([]);
      prisma.material.count.mockResolvedValue(0);
      const res = await request(app.getHttpServer()).get('/api/v1/materials/public');
      expect(res.status).toBe(200);
    });
  });

  describe('content (CMS del landing)', () => {
    it('GET /content/:section es público', async () => {
      prisma.contentBlock.findUnique.mockResolvedValue(null);
      const res = await request(app.getHttpServer()).get(`/api/v1/content/${ContentSection.HERO}`);
      expect(res.status).toBe(200);
    });

    it('GET /content/:section con una sección inválida responde 400', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/content/NO_EXISTE');
      expect(res.status).toBe(400);
    });

    it('PUT /content/:section sin token es rechazado con 401', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/content/${ContentSection.HERO}`)
        .send({ data: { title: 'Intento sin auth' } });

      expect(res.status).toBe(401);
    });

    it('PUT /content/:section con token de admin actualiza la sección', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser as any);
      prisma.user.update.mockResolvedValue(adminUser as any);
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'ClaveAdmin123' });

      prisma.contentBlock.upsert.mockResolvedValue({
        id: '1',
        section: ContentSection.HERO,
        data: { title: 'Los grandes sueños comienzan siendo un sueño' },
        updatedAt: new Date(),
      } as any);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/content/${ContentSection.HERO}`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ data: { title: 'Los grandes sueños comienzan siendo un sueño' } });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toContain('sueño');
    });
  });

  describe('leads (contacto / WhatsApp)', () => {
    it('POST /leads es público y no requiere token', async () => {
      prisma.lead.create.mockResolvedValue({
        id: '1',
        name: 'María',
        email: null,
        phone: '+51987654321',
        message: 'Info por favor',
        channel: LeadChannel.WHATSAPP,
        createdAt: new Date(),
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/leads')
        .send({ name: 'María', phone: '+51987654321', message: 'Info por favor', channel: LeadChannel.WHATSAPP });

      expect(res.status).toBe(201);
    });

    it('GET /leads (listar) requiere token de admin', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/leads');
      expect(res.status).toBe(401);
    });
  });

  describe('enrollments', () => {
    it('POST /enrollments sin token es rechazado con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .send({ userId: 'student-2', courseId: 'course-1' });

      expect(res.status).toBe(401);
    });

    it('POST /enrollments con admin asigna un curso a un estudiante', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser as any);
      prisma.user.update.mockResolvedValue(adminUser as any);
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'ClaveAdmin123' });

      prisma.enrollment.create.mockResolvedValue({
        id: 'enr-1',
        userId: 'student-2',
        courseId: 'course-1',
        expiresAt: null,
        progressPercent: 0,
        createdAt: new Date(),
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ userId: 'student-2', courseId: 'course-1' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe('student-2');
    });
  });
});
