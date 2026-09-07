export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwt: {
    // sin fallback: env.validation.ts hace fallar el arranque si falta
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  // archivos en disco local del VPS, no Supabase Storage
  storage: {
    uploadDir: process.env.MATERIALS_UPLOAD_DIR ?? './uploads',
    maxFileSizeBytes: parseInt(process.env.MATERIALS_MAX_FILE_SIZE_MB ?? '20', 10) * 1024 * 1024,
  },
  adminSeed: {
    email: process.env.ADMIN_SEED_EMAIL ?? 'admin@garymayhua.com',
    password: process.env.ADMIN_SEED_PASSWORD ?? 'CambiarEnProduccion123!',
  },
  mail: {
    apiKey: process.env.BREVO_API_KEY,
    fromEmail: process.env.BREVO_FROM_EMAIL,
    fromName: process.env.MAIL_FROM_NAME ?? 'Marca Personal',
    appUrl: process.env.APP_URL,
    ownerEmail: process.env.MAIL_OWNER_EMAIL ?? process.env.BREVO_FROM_EMAIL,
  },
  cloudinary: {
    url: process.env.CLOUDINARY_URL,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
});
