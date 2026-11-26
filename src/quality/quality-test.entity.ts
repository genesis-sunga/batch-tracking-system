import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { QualityOutcome } from '../common/enums';

@Entity('quality_tests')
@Index(['batchId', 'createdAt'])
export class QualityTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batchId: number;

  @Column({ length: 100 })
  testType: string;

  @Column({ type: 'enum', enum: QualityOutcome })
  outcome: QualityOutcome;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column()
  inspectorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
