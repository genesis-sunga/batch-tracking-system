export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  if (environment.NODE_ENV === 'production') {
    for (const name of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
      if (typeof environment[name] !== 'string' || environment[name].trim().length === 0) {
        throw new Error(`${name} must be configured in production`);
      }
    }
    const jwtSecret = environment.JWT_SECRET;
    if (
      typeof jwtSecret !== 'string' ||
      jwtSecret !== jwtSecret.trim() ||
      jwtSecret.length < 32
    ) {
      throw new Error('JWT_SECRET must contain at least 32 characters in production');
    }
    if (
      ['replace-with-a-long-random-secret', 'change-me', 'example'].includes(
        jwtSecret.toLowerCase(),
      )
    ) {
      throw new Error('JWT_SECRET must not use a placeholder value in production');
    }
    if (environment.DB_PASSWORD === 'change-me') {
      throw new Error('DB_PASSWORD must not use a placeholder value in production');
    }
  }

  const proxyHops = environment.TRUST_PROXY_HOPS;
  if (
    proxyHops !== undefined &&
    (!Number.isInteger(Number(proxyHops)) || Number(proxyHops) < 0)
  ) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  if (environment.SMTP_HOST && !environment.SMTP_FROM) {
    throw new Error('SMTP_FROM is required when SMTP_HOST is configured');
  }
  if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }
  return environment;
}
