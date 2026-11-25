import type { ArbeitszeitKonto } from '../hooks/useArbeitszeitKonto'
import { ArbeitszeitSaldoTile } from './ArbeitszeitSaldoTile'

interface Props {
  year: number
  konto: ArbeitszeitKonto
}

/**
 * Überstunden-Saldo eines Jahres in der Jahresübersicht (Issue #83) inkl.
 * automatisch berechnetem Übertrag aus dem Vorjahr. Ist/Soll und die manuelle
 * Bearbeitung des Übertrags entfallen seit Issue #89.
 */
export function ArbeitszeitJahresTile({ year, konto }: Props) {
  return (
    <ArbeitszeitSaldoTile label={`Überstunden-Saldo ${year}`} saldoMin={konto.ctx ? konto.gesamtSaldoMin : null}>
      {konto.jahr.fehlendeTage > 0 && (
        <span className="stat-sub stat-sub--warning">
          {konto.jahr.fehlendeTage} {konto.jahr.fehlendeTage === 1 ? 'Tag' : 'Tage'} ohne Zeiten
        </span>
      )}
    </ArbeitszeitSaldoTile>
  )
}
