import { Sql, Slot, empty } from "pgsql-template-tag";

export interface SlotType<TName extends string, TType> extends Slot<TName, TType> {
  nullable(): Slot<TName, TType | null>;
}

function newSlot<const TName extends string, TValue>(
  name: TName,
  defaultValue: TValue,
): SlotType<TName, TValue> {
  return Object.assign(new Slot<TName, TValue>(name, defaultValue), {
    nullable(this: Slot<TName, TValue>) {
      return new Slot<TName, TValue | null>(name, null);
    },
  });
}

export default function slot<const TName extends string>(name: TName) {
  return {
    sql: <TType extends Sql = Sql<[]>>() => newSlot(name, empty as TType),
    text: <TType extends string = string>() => newSlot(name, "" as TType),
    uuid: <TType extends string = string>() =>
      newSlot(name, "00000000-0000-0000-0000-000000000000" as TType),
    json: <TType extends string = string>() => newSlot(name, "null" as TType),
    jsonb: <TType extends string = string>() => newSlot(name, "null" as TType),
    bigint: <TType extends number | bigint = number | bigint>() => newSlot(name, 0 as TType),
    timestamp: <TType extends number = number>() => newSlot(name, 0 as TType),
  };
}
