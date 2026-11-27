import { validateEnvironment } from './env.validation';

describe('environment validation', () => {
  it('rejects placeholder production database and JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DB_HOST: 'db',
        DB_USERNAME: 'service',
        DB_PASSWORD: 'change-me',
        DB_DATABASE: 'batch_tracking',
        JWT_SECRET: 'replace-with-a-long-random-secret',
      }),
    ).toThrow('JWT_SECRET must not use a placeholder value in production');
  });

  it('accepts properly configured production secrets', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        DB_HOST: 'db',
        DB_USERNAME: 'service',
        DB_PASSWORD: 'long-database-password',
        DB_DATABASE: 'batch_tracking',
        JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
      }).NODE_ENV,
    ).toBe('production');
  });
});
