export type Identity = "admin" | "anson" | "beatrice";

export const IDENTITIES: readonly Identity[] = ["admin", "anson", "beatrice"];

export function isIdentity(value: unknown): value is Identity {
  return typeof value === "string" && (IDENTITIES as readonly string[]).includes(value);
}
