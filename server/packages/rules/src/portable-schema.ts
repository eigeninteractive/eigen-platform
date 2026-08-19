/**
 * The portable JSON Schema profile (RFC 0006): the subset of draft 2020-12 that
 * TypeScript and generated Dart validate *identically*.
 *
 * This exists because a game's schemas are authored in TypeScript and the Dart
 * side is generated from their emitted JSON Schema. Derivation is only sound if
 * the emitted document says exactly what the authoring library enforces, and it
 * does not by default: `z.tuple([Move, Move])` emits `prefixItems` with no
 * length bound, which accepts a three-element array that Zod itself rejects. A
 * validator generated from that document is *weaker than the server*, which is
 * the one failure mode a contract exists to prevent. So the profile is enforced
 * at emission and a violation is a build error naming a JSON pointer.
 *
 * The rule for admitting a keyword: it must constrain the same values in both
 * languages, and a generator must be able to enforce it. Everything else is
 * rejected even when a particular generator happens to ignore it harmlessly.
 */

/** Keywords a portable payload schema may use. */
const ALLOWED = new Set([
  "$schema",
  "$defs",
  "$ref",
  "type",
  "const",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "properties",
  "required",
  "additionalProperties",
  "minProperties",
  "maxProperties",
  "oneOf",
  "anyOf",
  "title",
  "description",
  "deprecated",
  "examples",
]);

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

/** A profile violation: where it is, and what is wrong. */
export interface PortableSchemaViolation {
  /** JSON pointer into the schema document. */
  pointer: string;
  /** What the profile requires instead. */
  problem: string;
}

/** Thrown by {@link assertPortableSchema}; carries every violation found. */
export class PortableSchemaError extends Error {
  constructor(
    readonly label: string,
    readonly violations: readonly PortableSchemaViolation[],
  ) {
    super(`${label} is outside the portable schema profile:\n${violations.map((v) => `  ${v.pointer}: ${v.problem}`).join("\n")}`);
    this.name = "PortableSchemaError";
  }
}

/** `true` for the `{"type": "null"}` branch of a nullable union. */
function isNullBranch(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "type" && (value as { type: unknown }).type === "null";
}

/**
 * Collect every way `schema` leaves the profile. Empty ⇒ portable.
 *
 * Reports all violations rather than the first, because a schema written against
 * the wrong idiom usually breaks in several places at once and fixing them one
 * build at a time is miserable.
 */
export function portableSchemaViolations(schema: unknown, pointer = ""): PortableSchemaViolation[] {
  const found: PortableSchemaViolation[] = [];
  const at = (path: string, problem: string) => found.push({ pointer: path === "" ? "/" : path, problem });

  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    at(pointer, "expected a schema object");
    return found;
  }
  const node = schema as Record<string, unknown>;

  for (const keyword of Object.keys(node)) {
    if (!ALLOWED.has(keyword)) at(`${pointer}/${keyword}`, "keyword is outside the portable profile");
  }

  if ("$schema" in node && node.$schema !== DRAFT) at(`${pointer}/$schema`, `must be ${DRAFT}`);
  if ("$ref" in node && (typeof node.$ref !== "string" || !node.$ref.startsWith("#/$defs/"))) {
    at(`${pointer}/$ref`, "only local #/$defs/ references are portable");
  }

  const types = Array.isArray(node.type) ? node.type : [node.type];
  // An object must close itself, or a generated validator and the authoring
  // library disagree about an unknown key. Zod's *input* schema omits this, which
  // is why the emitter asks for the output direction.
  if (types.includes("object") || "properties" in node) {
    if (node.additionalProperties !== false) at(pointer, "object schemas require additionalProperties: false");
  }
  // An array must bound its length or say its element type; `type: "array"` alone
  // constrains nothing.
  if (types.includes("array") && !("items" in node)) {
    at(pointer, "array schemas require items (use items with minItems/maxItems for a fixed length)");
  }
  if (types.includes("integer")) {
    for (const bound of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]) {
      if (bound in node && !Number.isSafeInteger(node[bound])) at(`${pointer}/${bound}`, "integer bound must be a safe integer");
    }
  }

  // `anyOf` is admitted in exactly one shape: the nullable wrapper every schema
  // library emits for `T | null`. It is equivalent to `type: [T, "null"]`, which
  // the profile already allows, and there is no other way to spell nullability —
  // Zod emits `anyOf` for `.nullable()` and nothing else. General `anyOf` stays
  // out: overlapping branches have no single Dart type and no discriminator to
  // generate a parser from.
  if ("anyOf" in node) {
    const branches = node.anyOf;
    if (!Array.isArray(branches) || branches.length !== 2 || !branches.some(isNullBranch)) {
      at(`${pointer}/anyOf`, 'anyOf is portable only as a nullable wrapper: exactly two branches, one of them {"type": "null"}');
    } else {
      branches.forEach((branch, index) => {
        if (!isNullBranch(branch)) found.push(...portableSchemaViolations(branch, `${pointer}/anyOf/${index}`));
      });
    }
  }

  // `oneOf` is the discriminated union: a generator needs a tag to pick a branch.
  if ("oneOf" in node) {
    const branches = node.oneOf;
    if (!Array.isArray(branches) || branches.length < 2) {
      at(`${pointer}/oneOf`, "oneOf requires at least two branches");
    } else {
      branches.forEach((branch, index) => {
        found.push(...portableSchemaViolations(branch, `${pointer}/oneOf/${index}`));
      });
    }
  }

  if (node.properties !== undefined) {
    if (typeof node.properties !== "object" || node.properties === null) at(`${pointer}/properties`, "expected an object");
    else {
      for (const [name, property] of Object.entries(node.properties as Record<string, unknown>)) {
        found.push(...portableSchemaViolations(property, `${pointer}/properties/${name}`));
      }
    }
  }
  if (node.items !== undefined) found.push(...portableSchemaViolations(node.items, `${pointer}/items`));
  if (node.$defs !== undefined) {
    if (typeof node.$defs !== "object" || node.$defs === null) at(`${pointer}/$defs`, "expected an object");
    else {
      for (const [name, definition] of Object.entries(node.$defs as Record<string, unknown>)) {
        found.push(...portableSchemaViolations(definition, `${pointer}/$defs/${name}`));
      }
    }
  }

  return found;
}

/** Throw {@link PortableSchemaError} unless `schema` is inside the profile. */
export function assertPortableSchema(schema: unknown, label: string): void {
  const violations = portableSchemaViolations(schema);
  if (violations.length > 0) throw new PortableSchemaError(label, violations);
}
