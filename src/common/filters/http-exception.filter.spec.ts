import { ArgumentsHost, BadRequestException, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(res: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

function buildResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('respeta el status code de una HttpException conocida (ForbiddenException -> 403)', () => {
    const res = buildResponse();
    filter.catch(new ForbiddenException('Tu acceso ha vencido'), buildHost(res));

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Tu acceso ha vencido' }),
    );
  });

  it('propaga el array de mensajes de un BadRequestException (errores de class-validator)', () => {
    const res = buildResponse();
    filter.catch(new BadRequestException(['email debe ser válido']), buildHost(res));

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toEqual(['email debe ser válido']);
  });

  it('degrada cualquier error NO-HTTP (ej. una excepción de Prisma) a 500 sin filtrar detalles internos', () => {
    const res = buildResponse();
    filter.catch(new Error('connection terminated unexpectedly (detalle interno de Postgres)'), buildHost(res));

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(body)).not.toContain('Postgres');
  });

  it('siempre incluye un timestamp ISO', () => {
    const res = buildResponse();
    filter.catch(new ForbiddenException(), buildHost(res));

    const body = res.json.mock.calls[0][0];
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});
