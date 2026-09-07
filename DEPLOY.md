# Despliegue en producción

> Este repo levanta con **Docker Compose desde la raíz**. No hay que entrar a subcarpetas
> (`docker-compose.yml`, `Dockerfile`, `nginx/conf.d/api.conf` y `.env.production` están en la raíz).

## Topología

- **Frontend**: Vercel (`garymayhua.com`).
- **Backend (API)**: contenedor Docker en el VPS Contabo, en `api.garymayhua.com` vía nginx del mismo stack.
- **Base de datos**: Supabase (solo la usa el backend).
- **Archivos**: disco del VPS (volumen `materials-data`).

## 1. Comprobar que levanta en local

Desde la raíz del proyecto (`Marca_personal_Backend`):

```bash
docker compose build
docker compose up -d
```

Healthcheck (respuesta `{"status":"ok"}`):

```bash
curl http://localhost/api/v1/health
```

> Nota local en Windows: si el puerto 80/443 está ocupado (p. ej. un stack
> `docker compose` anterior llamado `deploy`), bájalo con `docker compose down` o
> `docker compose -p <proyecto> down` para liberar el puerto y vuelve a `docker compose up -d`.

## 2. `.env.production`

Crearlo a partir de `.env.example`. No se commitea (en `.gitignore`).

## 3. Subir la imagen a un registro

```bash
docker tag gary-mayhua-api:1.0.0 <registry>/gary-mayhua-api:1.0.0
docker push <registry>/gary-mayhua-api:1.0.0
```

## 4. Desplegar en el VPS (Contabo)

En el servidor, estando en la raíz del proyecto (con `docker-compose.yml`,
`Dockerfile`, `nginx/conf.d/api.conf` y `.env.production`):

```bash
docker compose pull
docker compose up -d --pull always
```

La API queda en `http://api.garymayhua.com/api/v1` (Swagger en `/api/docs`).
Al arrancar, el entrypoint ejecuta `prisma migrate deploy`, el seed del admin
(compilado a `dist/prisma/seed.js`, ya no depende de `ts-node` en runtime) y
`node dist/main.js`.

## 5. HTTPS

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.garymayhua.com
```

## 6. Tarea programada (job de vencimiento)

Expose: `POST /api/v1/app/expiration-alerts` con `Authorization: Bearer <token>`.
Programar en el VPS con cron (ej. 08:00 diario).
