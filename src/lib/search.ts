export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function matchesSearchText(value: string, search: string): boolean {
  return normalizeSearchText(value).includes(normalizeSearchText(search.trim()))
}
