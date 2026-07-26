// Sezona = godina datuma utakmice (npr. '2026-05-10' -> 2026)
export function seasonOf(dateStr) {
  return parseInt(String(dateStr).slice(0, 4), 10)
}

// Trenutna (najnovija) sezona iz liste utakmica.
// Ako nema utakmica, vraća tekuću kalendarsku godinu.
export function getCurrentSeason(matches) {
  if (!matches || matches.length === 0) return new Date().getFullYear()
  return Math.max(...matches.map(m => seasonOf(m.played_at)))
}

// Sve sezone (godine) koje postoje, silazno.
export function getAllSeasons(matches) {
  if (!matches || matches.length === 0) return [new Date().getFullYear()]
  const years = [...new Set(matches.map(m => seasonOf(m.played_at)))]
  return years.sort((a, b) => b - a)
}
