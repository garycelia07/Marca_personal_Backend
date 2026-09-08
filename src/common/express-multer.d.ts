/**
 * Declaración propia del namespace `Express.Multer.File`.
 *
 * Con `multer@2` instalado, el antiguo `@types/multer` (1.x) deja de registrar
 * `Express.Multer` en el namespace global de Express, por eso TypeScript se queja
 * con "Namespace 'global.Express' has no exported member 'Multer'".
 * Estos tipos cubren el shape del archivo que inyecta FileInterceptor para que
 * los 17 `Express.Multer.File` del código sigan compilando sin depender de ese bug.
 */
declare namespace Express {
  namespace Multer {
    interface File {
      /** Name of the form field associated with this file. */
      fieldname: string;
      /** Name of the file on the user's computer. */
      originalname: string;
      /** Encoding type of the file. */
      encoding: string;
      /** Mime type of the file. */
      mimetype: string;
      /** Size of the file in bytes. */
      size: number;
      /** Full path to the uploaded file (disk storage). */
      path?: string;
      /** Directory where the file was stored (disk storage). */
      destination?: string;
      /** Name of the stored file (disk storage). */
      filename?: string;
      /** Buffer containing the file (memory storage). */
      buffer: Buffer;
    }
  }
}
