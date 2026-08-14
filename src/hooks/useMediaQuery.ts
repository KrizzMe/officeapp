import { useEffect, useState } from 'react'

/** Reaktiver `matchMedia`-Zustand, z. B. für Layout-Entscheidungen unterhalb eines CSS-Breakpoints in JSX. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
