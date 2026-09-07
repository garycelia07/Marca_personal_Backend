import { BadGatewayException } from '@nestjs/common';
export interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}
export const LESSON_VIDEO_FOLDER = 'course-lessons';

export interface CloudinarySettings {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

export function isCloudinaryConfigured(
  settings?: Partial<CloudinarySettings> | null,
): boolean {
  return Boolean(
    settings && settings.cloudName && settings.apiKey && settings.apiSecret,
  );
}

export function buildBasicAuth({ apiKey, apiSecret }: CloudinaryCreds): string {
  return 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
}

export function lessonCloudinaryPublicId(lessonId: string): string {
  return `${LESSON_VIDEO_FOLDER}/lesson-${lessonId}`;
}

export async function uploadVideoToCloudinary(
  creds: CloudinaryCreds,
  input: {
    lessonId: string;
    buffer: Buffer;
    mimeType: string;
    filename: string;
  },
): Promise<string> {
  const endpoint = `https://api.cloudinary.com/v1_1/${creds.cloudName}/video/upload`;

  const form = new FormData();
  const blob = new Blob([input.buffer as unknown as BlobPart], {
    type: input.mimeType || 'video/mp4',
  });
  form.append('file', blob, input.filename || 'lesson-video.mp4');
  form.append('public_id', `lesson-${input.lessonId}`); // dentro del folder
  form.append('folder', LESSON_VIDEO_FOLDER);
  form.append('overwrite', 'true');
  form.append('resource_type', 'video');
  form.append('use_filename', 'false');
  form.append('unique_filename', 'false');

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: buildBasicAuth(creds) },
      body: form,
    });
  } catch {
    throw new BadGatewayException('No fue posible conectar con Cloudinary.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new BadGatewayException(
      `Cloudinary rechazó el video (${res.status} ${res.statusText}): ${text.slice(0, 200)}`,
    );
  }

  const payload = (await res.json()) as { secure_url?: string; public_id?: string; format?: string };
  if (!payload.secure_url) {
    throw new BadGatewayException('Cloudinary respondió sin URL de video.');
  }
  return payload.secure_url;
}

/** Elimina (destroy) el video de una lección alojado en Cloudinary. */
export async function destroyCloudinaryVideo(
  creds: CloudinaryCreds,
  lessonId: string,
): Promise<void> {
  const endpoint = `https://api.cloudinary.com/v1_1/${creds.cloudName}/video/destroy`;
  const form = new FormData();
  form.append('public_id', lessonCloudinaryPublicId(lessonId));
  form.append('invalidate', 'true');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: buildBasicAuth(creds) },
      body: form,
    });
    const payload = (await res.json().catch((): { result?: string } => ({}))) as {
      result?: string;
    };
    // ok cuando result === 'ok'; si ya no existía ('not found') también lo damos por bueno.
    const ok = res.ok && (payload.result === 'ok' || payload.result === 'not found');
    if (!ok) {
      throw new Error(`Cloudinary destroy falló: ${res.status} ${JSON.stringify(payload)}`);
    }
  } catch (error) {
    // No bloqueemos un borrado en DB por un fallo de limpieza en el CDN.
    // eslint-disable-next-line no-console
    console.warn('No se pudo destruir el video en Cloudinary:', (error as Error).message);
  }
}
