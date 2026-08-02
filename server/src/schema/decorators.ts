import type { Generated as KyselyGenerated } from 'kysely';

export type Timestamp = Date | string;
export type Generated<T> = KyselyGenerated<T>;

type DecoratorTarget = object | Function;

export const Table = (_tableName: string) => (target: DecoratorTarget): void => {
  void target;
};

export const Column = (_options: { type?: string; default?: unknown; nullable?: boolean; unique?: boolean } = {}) => (
  _target: DecoratorTarget,
  _propertyKey: string | symbol,
): void => {
  void _target;
  void _propertyKey;
};

export const PrimaryGeneratedColumn = () => (_target: DecoratorTarget, _propertyKey: string | symbol): void => {
  void _target;
  void _propertyKey;
};

export const CreateDateColumn = () => (_target: DecoratorTarget, _propertyKey: string | symbol): void => {
  void _target;
  void _propertyKey;
};

export const UpdateDateColumn = () => (_target: DecoratorTarget, _propertyKey: string | symbol): void => {
  void _target;
  void _propertyKey;
};

export const ForeignKeyColumn = (_reference: unknown, _options?: object) => (
  _target: DecoratorTarget,
  _propertyKey: string | symbol,
): void => {
  void _target;
  void _propertyKey;
};

export const ForeignKeyConstraint = (_options?: object) => (target: DecoratorTarget): void => {
  void target;
};

export const Index = (_options?: object) => (target: DecoratorTarget): void => {
  void target;
};

export const UpdateIdColumn = (_options?: object) => (_target: DecoratorTarget, _propertyKey: string | symbol): void => {
  void _target;
  void _propertyKey;
};

export const Check = (_options?: object) => (target: DecoratorTarget): void => {
  void target;
};
