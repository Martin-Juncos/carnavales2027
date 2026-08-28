export const fixedComparsaNames = ['Tropicala', 'Ita Vera', 'Arami', 'Aymara', 'Oh Bahia', 'Poramba'] as const

export function isFixedComparsaName(name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase('es-AR')
  return fixedComparsaNames.some((fixedName) => fixedName.toLocaleLowerCase('es-AR') === normalized)
}
