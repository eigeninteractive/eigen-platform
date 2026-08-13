import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

export type { StandardJSONSchemaV1 } from "@standard-schema/spec";

/** One game payload declaration: runtime validation plus portable schema
 * emission from the same transform-free object. Input and output deliberately
 * share one type: what parses is what persists and what Dart generates. */
export type GamePayloadSchema<Payload> = StandardSchemaV1<Payload, Payload> & StandardJSONSchemaV1<Payload, Payload>;
