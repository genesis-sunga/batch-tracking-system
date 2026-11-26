import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { UserRole } from '../common/enums';
import { User } from './user.entity';

async function seedAdmin(): Promise<void> {
  const host = process.env.DB_HOST;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!host || !username || !password || !database || !email || !adminPassword) {
    throw new Error('Database credentials and INITIAL_ADMIN_EMAIL/PASSWORD are required');
  }
  if (adminPassword.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be at least 12 characters');
  }

  const dataSource = new DataSource({
    type: 'mysql',
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    username,
    password,
    database,
    entities: [User],
    synchronize: process.env.NODE_ENV !== 'production',
  });
  await dataSource.initialize();
  try {
    const userRepository = dataSource.getRepository(User);
    if (await userRepository.count()) {
      throw new Error('User table is not empty; refusing to seed another initial administrator');
    }
    await userRepository.save(
      userRepository.create({
        email,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: UserRole.ADMIN,
      }),
    );
    console.log(`Initial administrator created: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

void seedAdmin().catch((error: unknown) => {
  console.error('Failed to seed initial administrator:', error);
  process.exitCode = 1;
});
