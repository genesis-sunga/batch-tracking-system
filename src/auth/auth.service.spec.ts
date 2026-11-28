import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  const credentials: LoginDto = {
    email: 'user@example.com',
    password: 'correct-password',
  };
  const user = {
    id: 12,
    email: credentials.email,
    passwordHash: bcrypt.hashSync(credentials.password, 4),
    role: 'warehouse_operator',
  } as User;

  let service: AuthService;
  let query: SelectQueryBuilder<User>;
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    query = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    } as unknown as SelectQueryBuilder<User>;
    const users = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    } as unknown as Repository<User>;
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    service = new AuthService(users, jwt as unknown as JwtService);
    jest.spyOn(bcrypt, 'compare');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a JWT after verifying the stored password hash', async () => {
    await expect(service.login(credentials)).resolves.toEqual({
      accessToken: 'signed-jwt',
    });
    expect(query.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, user.passwordHash);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('rejects unknown users without attempting password comparison', async () => {
    query.getOne = jest.fn().mockResolvedValue(null);

    await expect(service.login(credentials)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password without issuing a token', async () => {
    await expect(
      service.login({ ...credentials, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
