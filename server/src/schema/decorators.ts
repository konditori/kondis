import type { Generated as KyselyGenerated } from 'kysely';

export type Timestamp = Date | string;
export type Generated<T> = KyselyGenerated<T>;

type DecoratorTarget = object | ((...args: unknown[]) => unknown);
type TableConstructor = abstract new (...arguments_: never[]) => unknown;

const COLUMNS = Symbol('columns');
type ColumnCarrier = { [COLUMNS]?: string[] };

const noopClassDecorator = (target: DecoratorTarget): void => {
  void target;
};

// Registers the decorated property on its class so column lists can be derived from the schema instead of hand-copied.
const registerColumn = (target: DecoratorTarget, propertyKey: string | symbol): void => {
  // SAFETY: Decorators receive a class prototype whose constructor carries this module's column symbol.
  const ctor = (target as { constructor: ColumnCarrier }).constructor;
  if (!Object.prototype.hasOwnProperty.call(ctor, COLUMNS)) {
    ctor[COLUMNS] = [];
  }
  ctor[COLUMNS]!.push(String(propertyKey));
};

export const Table = (_tableName: string) => noopClassDecorator;

export const Column = (_options: { type?: string; default?: unknown; nullable?: boolean; unique?: boolean } = {}) =>
  registerColumn;

export const PrimaryGeneratedColumn = () => registerColumn;

export const CreateDateColumn = () => registerColumn;

export const UpdateDateColumn = () => registerColumn;

export const ForeignKeyColumn = (_reference: unknown, _options?: object) => registerColumn;

export const ForeignKeyConstraint = (_options?: object) => noopClassDecorator;

export const Index = (_options?: object) => noopClassDecorator;

export const UpdateIdColumn = (_options?: object) => registerColumn;

export const Check = (_options?: object) => noopClassDecorator;

// Single source of truth for a table's column names, derived from its @Column-decorated fields.
export const getColumns = <T>(ctor: TableConstructor & { new (...arguments_: never[]): T }): (keyof T)[] =>
  // SAFETY: registerColumn writes only string property names under COLUMNS on this constructor.
  ((ctor as unknown as ColumnCarrier)[COLUMNS] ?? []) as (keyof T)[];
