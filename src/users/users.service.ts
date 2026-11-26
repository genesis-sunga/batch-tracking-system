import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

export type PublicUser = Pick<User, 'id' | 'email' | 'role' | 'createdAt'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserDto, actor: AuthenticatedUser): Promise<PublicUser> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      if (await users.findOneBy({ email: input.email })) {
        throw new ConflictException('A user with this email already exists');
      }

      const user = await users.save(
        users.create({
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 12),
          role: input.role,
        }),
      );
      await this.audit.record(manager, actor, 'user_created', 'user', user.id, {
        email: user.email,
        role: user.role,
      });
      return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
    });
  }
}
