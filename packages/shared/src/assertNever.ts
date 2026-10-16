/**
 * Compile-time exhaustiveness check for discriminated unions.
 * If a new union member is added and not handled, the call site stops compiling.
 */
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
