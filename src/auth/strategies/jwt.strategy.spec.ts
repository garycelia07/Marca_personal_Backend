import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { Role } from '../../common/enums/role.enum';

describe('JwtStrategy', () => {
  it('validate() devuelve el payload tal cual, para que quede disponible como request.user', async () => {
    const config = { get: jest.fn().mockReturnValue('un-secreto') } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const payload = {
      sub: 'user-1',
      email: 'admin@x.com',
      role: Role.ADMIN,
      accessExpiresAt: null,
    };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });
});
