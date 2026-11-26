export function logError(scope: string, err: unknown): void {
  console.error(`[jet-joy:${scope}]`, err)
}
