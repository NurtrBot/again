import 'server-only';
/* Small helpers shared by route pages (UI workstream). */
export type SP = Record<string, string | string[] | undefined>;

export function first(sp: SP, key: string): string | null {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
