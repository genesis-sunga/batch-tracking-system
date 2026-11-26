import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  sku: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 40, default: 'unit' })
  unit: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
