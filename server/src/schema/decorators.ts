import type { Generated as KyselyGenerated } from 'kysely';

export type Timestamp = Date | string;
export type Generated<T> = KyselyGenerated<T>;

type DecoratorTarget = object | ((...args: unknown[]) => unknown);

const noopClassDecorator = (target: DecoratorTarget): void => {
  void target;
};

const noopPropertyDecorator = (_target: DecoratorTarget, _propertyKey: string | symbol): void => {
  void _propertyKey;
};

export const Table = (_tableName: string) => noopClassDecorator;

export const Column = (_options: { type?: string; default?: unknown; nullable?: boolean; unique?: boolean } = {}) =>
  noopPropertyDecorator;

export const PrimaryGeneratedColumn = () => noopPropertyDecorator;

export const CreateDateColumn = () => noopPropertyDecorator;

export const UpdateDateColumn = () => noopPropertyDecorator;

export const ForeignKeyColumn = (_reference: unknown, _options?: object) => noopPropertyDecorator;

export const ForeignKeyConstraint = (_options?: object) => noopClassDecorator;

export const Index = (_options?: object) => noopClassDecorator;

export const UpdateIdColumn = (_options?: object) => noopPropertyDecorator;

export const Check = (_options?: object) => noopClassDecorator;
