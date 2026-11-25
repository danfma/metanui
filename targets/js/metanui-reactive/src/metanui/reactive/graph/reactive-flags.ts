export const ReactiveFlags = {
  None: 0,
  Mutable: 1,
  Watching: 2,
  RecursedCheck: 4,
  Recursed: 8,
  Dirty: 16,
  Pending: 32,
  Errored: 64,
} as const;

export type ReactiveFlags = number & { readonly __enum?: "ReactiveFlags" };
