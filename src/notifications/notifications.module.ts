import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from '../batches/batch.entity';
import { User } from '../users/user.entity';
import { EmailOutbox } from './email-outbox.entity';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutbox, Batch, User])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
