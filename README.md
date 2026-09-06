# Gary Mayhua Platform — API (NestJS, monolito modular)

Backend para la plataforma institucional + LMS de Gary Mayhua. Arquitectura de
**monolito modular** en NestJS: un solo despliegue, módulos con límites claros
y bajo acoplamiento (cada uno con su propio `service`/`controller`/`dto`,
comunicándose entre sí solo a través de servicios exportados — nunca acceso
directo entre repositorios de otro módulo).

## Stack

- **NestJS 10** + TypeScript
- **Prisma** → Postgres de **Supabase** (conexión pooled para runtime, directa para migraciones) — **solo la base de datos**, nada de storage.
- **Disco local del VPS** → almacenamiento de PDFs e imágenes (carpeta `MATERIALS_UPLOAD_DIR`, fuera del repo, persistente entre despliegues). Al reemplazar un material se borra primero el archivo físico viejo y luego se guarda el nuevo (ver `MaterialsService.replace`).
- **JWT propio** (passport-jwt) + bcrypt → *no* se usa Supabase Auth, porque el
  requisito de "vigencia de acceso personalizada por el admin" no encaja con
  el modelo de auto-registro de Supabase Auth.

## Módulos

| Módulo         | Responsabilidad                                                                 |
|----------------|-----------------------------------------------------------------------------------|
| `auth`         | Login, emisión de JWT, guards globales (autenticación, vigencia, roles)          |
| `users`        | Alta/edición/baja de estudiantes por el admin; vigencia de acceso global        |
| `courses`      | Cursos → módulos → lecciones                                                     |
| `materials`    | Subida/reemplazo/gestión de PDFs en disco local del VPS + streaming de descarga  |
| `enrollments`  | Relación estudiante↔curso, con vigencia opcional por curso                       |
| `content`      | CMS liviano del landing público (Hero, Nosotros, Historia, Proyectos, Servicios, Redes) |
| `leads`        | Contactos entrantes (botón flotante de WhatsApp / formularios)                   |
| `health`       | Healthcheck                                                                       |
| `prisma`       | Cliente de base de datos (global)                                                |
| `common`       | Guards, decorators, filtros y enums compartidos                                 |

## Modelo de acceso / vigencia

1. `User.accessExpiresAt` — vigencia **global** del estudiante, la define el admin al crearlo.
2. `Enrollment.expiresAt` — vigencia **por curso**, opcional, sobreescribe/complementa la global.
3. Guards en cadena (orden real de ejecución):
   - `JwtAuthGuard` → valida el token (rutas `@Public()` lo saltan).
   - `AccessExpirationGuard` → si es `STUDENT` y venció `accessExpiresAt`, corta con 403.
   - `RolesGuard` → exige `@Roles(Role.ADMIN)` donde corresponda.
   - `EnrollmentsService.assertActiveAccess()` se invoca puntualmente al servir contenido de un curso, para validar la vigencia específica de ese curso.

## Setup en Supabase (solo base de datos)

1. Crear proyecto en https://supabase.com.
2. **Database** → copiar el *connection string* con pooling (puerto 6543) para `DATABASE_URL`, y el directo (puerto 5432) para `DIRECT_URL`.

Storage no aplica: los archivos viven en el disco del VPS (ver siguiente sección).

## Almacenamiento de archivos en el VPS

- `MATERIALS_UPLOAD_DIR` (en `.env`) apunta a la carpeta donde se guardan los PDFs/imágenes subidos, p.ej. `/var/www/gary-mayhua-api/uploads/materials` en producción. El servicio la crea sola si no existe (`mkdir -p` en el arranque).
- **Debe quedar fuera del repo git** y, en producción, fuera también de la carpeta que reconstruye cada deploy (si haces `git pull` + rebuild en el mismo path, un `rm -rf` accidental del working dir se llevaría los PDFs). Lo más seguro: un path absoluto fuera del repo, ej. `/data/gary-mayhua/materials`, y montar eso como volumen si usas Docker.
- **Backups**: como esto ya no vive en Supabase, tú eres responsable del backup de esta carpeta (rsync/cron a otro disco, snapshot del VPS, etc.). La base de datos (Postgres en Supabase) sí tiene sus propios backups automáticos del lado de Supabase.
- **Reemplazo de archivo** (`PUT /materials/:id`): borra el archivo físico anterior del disco y guarda el nuevo bajo un nombre distinto (evita colisiones/caché de navegador), todo en la misma fila de la base de datos — no queda ni el archivo viejo en disco ni una referencia vieja en la DB.
- **Validación de subida**: tamaño máximo `MATERIALS_MAX_FILE_SIZE_MB` (default 20MB) y solo se aceptan `application/pdf`, `image/jpeg`, `image/png`, `image/webp` (ver `materials.constants.ts`). Se valida en dos capas: límite duro de multer (corta la subida apenas se excede) + `ParseFilePipe` (responde 422 legible si el tipo no es válido).

## Puesta en marcha local

Requiere [pnpm](https://pnpm.io) (`corepack enable && corepack prepare pnpm@latest --activate`, o `npm install -g pnpm`).

```bash
cp .env.example .env
# completar .env con los datos de tu proyecto Supabase

pnpm install
pnpm run prisma:generate
pnpm run prisma:deploy     # aplica el historial de prisma/migrations/ (no crea migraciones nuevas)
pnpm exec prisma db seed   # crea el usuario admin inicial (ADMIN_SEED_EMAIL/PASSWORD)

pnpm run start:dev
```

La primera vez, pnpm puede pedir aprobar los scripts de instalación de `@nestjs/core` y `prisma`/`@prisma/client` (generan el cliente de Prisma): `pnpm approve-builds --all`.

API disponible en `http://localhost:3000/api/v1`.

## Migraciones de base de datos

El schema tiene historial versionado en `prisma/migrations/` (ya no se usa `prisma db push`, que no deja rastro de qué cambió ni cuándo).

- **Aplicar migraciones existentes** (clonaste el repo, o estás desplegando): `pnpm exec prisma migrate deploy`. No pide nada interactivo, seguro para CI/producción.
- **Crear una migración nueva** (cambiaste `prisma/schema.prisma`): en tu propia terminal (esto SÍ es interactivo, no corre en un entorno automatizado):
  ```bash
  pnpm exec prisma migrate dev --name describe_el_cambio
  ```
  Esto genera el SQL, lo aplica a tu DB de desarrollo, y lo versiona en `prisma/migrations/<timestamp>_describe_el_cambio/`. Commitear esa carpeta junto con el cambio de schema.
- **Nunca** editar una migración ya commiteada y aplicada en cualquier ambiente compartido — si algo salió mal, se crea una migración nueva que corrige, igual que con cualquier otro código versionado.

## Documentación interactiva (Swagger)

Con el servidor corriendo:

- **UI interactiva**: http://localhost:3000/api/docs — todos los endpoints, request/response de cada uno, y puedes probarlos directo desde el navegador.
  1. Hacer `POST /auth/login` ahí mismo para obtener el `accessToken`.
  2. Click en **Authorize** (arriba a la derecha) y pegar el token (sin la palabra "Bearer").
  3. Ya se puede probar cualquier endpoint protegido, incluida la subida de PDFs (el campo `file` aparece como selector de archivo real).
- **JSON crudo (OpenAPI 3)**: http://localhost:3000/api/docs-json — úsalo para generar un cliente tipado en el front automáticamente, por ejemplo con [`openapi-typescript`](https://www.npmjs.com/package/openapi-typescript) u [`orval`](https://orval.dev/):
  ```bash
  pnpm dlx openapi-typescript http://localhost:3000/api/docs-json -o src/types/api.d.ts
  ```
  Así el front tiene los tipos exactos de cada request/response sin escribirlos a mano, y cualquier cambio en el backend se refleja regenerando ese archivo.

Los DTOs se documentan solos gracias al plugin `@nestjs/swagger` (configurado en `nest-cli.json`), que lee los tipos de TypeScript en tiempo de build — por eso alcanza con correr `pnpm run build`/`start:dev` para que la doc quede al día, sin mantenerla a mano aparte.

## Endpoints principales

```
POST   /api/v1/auth/login                         (público)

POST   /api/v1/students                           (admin)  crear estudiante + vigencia
GET    /api/v1/students                           (admin)  listar estudiantes
PATCH  /api/v1/students/:id/access-expiration     (admin)  editar vigencia

GET    /api/v1/courses                            (auth)   cursos publicados
GET    /api/v1/courses/admin                      (admin)  todos los cursos
POST   /api/v1/courses                            (admin)
POST   /api/v1/courses/:id/modules                (admin)
POST   /api/v1/courses/modules/:moduleId/lessons  (admin)

POST   /api/v1/materials              (multipart/form-data, campo "file")   (admin)  subir PDF/imagen
PUT    /api/v1/materials/:id          (multipart/form-data, campo "file" opcional) (admin)  reemplazar archivo y/o metadata
GET    /api/v1/materials/public                   (público) listado de material descargable del landing
GET    /api/v1/materials/:id/file                 (auth)   descarga/stream directo desde el VPS

POST   /api/v1/enrollments                        (admin)  asignar curso a estudiante
GET    /api/v1/enrollments/me                     (auth)   mis cursos

GET    /api/v1/content                            (público) todo el contenido del landing
PUT    /api/v1/content/:section                   (admin)  editar sección (HERO, ABOUT, STORY, PROJECTS, SERVICES, SOCIAL_LINKS)

POST   /api/v1/leads                               (público) contacto / WhatsApp
GET    /api/v1/leads                               (admin)
```

## Testing

```bash
pnpm test          # unit tests (src/**/*.spec.ts)
pnpm run test:watch
pnpm run test:cov  # con reporte de cobertura
pnpm run test:e2e  # e2e (test/**/*.e2e-spec.ts)
```

**Ninguno de los dos toca tu Supabase real**: `PrismaService` se reemplaza por un mock profundo y tipado (`jest-mock-extended`, ver `src/test/prisma-mock.ts`), así que corren rápido, en cualquier máquina/CI, sin depender de la red ni de datos existentes en la base.

**Cobertura actual: 83 tests (56 unit + 27 e2e), uno por cada service/guard/filter del proyecto.**

- **Unit** (`src/**/*.spec.ts`) — un archivo por cada pieza de lógica de negocio, aislada de HTTP/DB real:
  - `auth.service.spec.ts`: login válido/inválido, usuario inactivo, y el caso clave — **vigencia vencida bloquea el login y nunca emite token**.
  - `access-expiration.guard.spec.ts` / `roles.guard.spec.ts`: los guards globales de la cadena auth → vigencia → roles.
  - `jwt.strategy.spec.ts`: el payload del JWT queda disponible tal cual en `request.user`.
  - `http-exception.filter.spec.ts`: cualquier error no-HTTP (ej. uno de Prisma) se degrada a 500 genérico sin filtrar detalles internos; los HttpException conservan su status/mensaje real.
  - `users.service.spec.ts`: alta de estudiante con/sin vigencia, conflicto de correo duplicado, edición de vigencia.
  - `materials.service.spec.ts`: el flujo de reemplazo de archivo — confirma que el archivo **nuevo se escribe antes de borrar el viejo** (para no perder el archivo si la escritura falla) y que apunta al `storageKey` correcto.
  - `enrollments.service.spec.ts`: vigencia por curso puntual (`Enrollment.expiresAt`), independiente de la vigencia global del usuario.
  - `courses.service.spec.ts`, `content.service.spec.ts`, `leads.service.spec.ts`: CRUDs de cursos/módulos/lecciones, CMS del landing (upsert por sección), y contactos.
- **E2E** (`test/app.e2e-spec.ts`) — levanta la app Nest completa (todos los guards/pipes/filtros reales) vía `supertest`, con Prisma mockeado, cubriendo los 8 módulos: rutas públicas sin token, rutas protegidas que rechazan sin token o con token adulterado, `RolesGuard` bloqueando a un STUDENT en rutas de ADMIN, subida real de PDF multipart (con rechazo de tipo de archivo inválido), y el flujo `POST /auth/login` → usar el token devuelto contra rutas reales de cada módulo.

**Nota de diseño encontrada haciendo los e2e**: el validador de tipo de archivo de Nest, por default, inspecciona los bytes reales del archivo (vía el paquete ESM `file-type`), lo cual es más seguro pero es frágil bajo Jest (el import dinámico de ese paquete falla silenciosamente en el test runner, aunque funciona bien en el servidor real). Se optó por `skipMagicNumbersValidation: true` — valida solo el `Content-Type` declarado por el cliente — porque el endpoint de subida es exclusivo de ADMIN autenticado, no una subida pública; si en el futuro se abre a usuarios no confiables, conviene reactivar la validación por bytes reales (ver comentario en `materials.controller.ts`).

## Deuda técnica: resuelta vs. pendiente

**Resuelto en esta pasada:**
- ✅ Migraciones versionadas en `prisma/migrations/` (ya no `db push`) — ver sección arriba.
- ✅ `tsconfig.json` con `"strict": true` completo (antes solo algunas flags sueltas).
- ✅ La API falla fuerte al arrancar si falta `JWT_SECRET`/`DATABASE_URL`/`DIRECT_URL`, o si `JWT_SECRET` es muy corto — ya no hay fallback silencioso a un secreto de desarrollo (`src/config/env.validation.ts`).
- ✅ Paginación (`?page=&limit=`, máx. 100 por página) en todos los listados: estudiantes, cursos, materiales, leads, enrollments. Respuesta uniforme `{ data, meta: { total, page, limit, totalPages } }`.
- ✅ Vulnerabilidades de `npm audit` en dependencias de producción: de 28 a 4 (las 4 restantes exigen migrar Nest 10→11, un upgrade de framework mayor, fuera de alcance de un fix de rebote). Se reemplazó `bcrypt` nativo por `bcryptjs` (sin binarios nativos, mejor también para el deploy en VPS) y se fijaron versiones parcheadas de `qs`, `multer`, `lodash`, `js-yaml` y `body-parser` vía `overrides` en `pnpm-workspace.yaml`.
- ✅ Gestor de paquetes: pnpm en vez de npm (instalación más rápida, `node_modules` estricto que evita dependencias fantasma, lockfile único versionado).

**Sigue pendiente** (de la auditoría original):
- Rate limiting ya incluido (`ThrottlerModule`) pero genérico — falta un límite más estricto específico para `/auth/login` (fuerza bruta).
- `/health` no verifica conectividad real a la base de datos, solo responde `ok` de forma estática.
- El JWT es stateless: `accessExpiresAt` queda fijo en el token al momento del login — si el admin recorta la vigencia de un alumno a mitad de sesión, su token sigue funcionando hasta que expire solo (hasta `JWT_EXPIRES_IN`, default 8h). No hay revocación inmediata ni blacklist de tokens.
- No hay CI (`.github/workflows`) que corra los 84 tests automáticamente en cada push/PR.
- Los deletes son irreversibles e inmediatos (cascade en cursos, borrado físico en materiales) — no hay soft-delete ni papelera de reciclaje.
- Sin pre-commit hooks (husky/lint-staged).
- Agregar refresh tokens si se requiere sesión larga en el panel admin.
- Agregar un job (cron) que marque/notifique estudiantes cuya vigencia vence pronto.
