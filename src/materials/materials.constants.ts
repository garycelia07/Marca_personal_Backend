export const ALLOWED_MATERIAL_MIME_TYPES = /^(application\/pdf|image\/(jpeg|png|webp))$/;

// leído directo de process.env: alimenta opciones de FileInterceptor, evaluadas antes de la DI
export const MAX_MATERIAL_FILE_SIZE_BYTES =
  parseInt(process.env.MATERIALS_MAX_FILE_SIZE_MB ?? '20', 10) * 1024 * 1024;
