# Hinweise für Claude in diesem Repo

- Vor größeren/weitreichenden Aktionen (z. B. mergen, pushen, löschen) erst per Rückfrage bestätigen lassen, statt direkt zu handeln.
- Nach einem erfolgreich gemergten Pull Request immer fragen, ob die Session/der Chat archiviert werden soll.
- Immer wenn ein Pull Request erstellt wurde, fragen wie es weitergehen soll, statt von sich aus weitere Schritte (z. B. Ready for review, Review anfordern) zu unternehmen.
- WICHTIG: Jede Rückfrage an den Nutzer — ausnahmslos, überall in diesem Workflow und in diesem Repo, wo "fragen"/"Rückfrage" steht — immer über das AskUserQuestion-Tool mit klickbaren Antwortoptionen stellen. Niemals eine Frage als reiner Fließtext am Ende einer Nachricht stellen, auch nicht beiläufig oder als Nebensatz.

## Standard-Workflow für neue Anforderungen

"Ticket" = GitHub Issue in diesem Repo.

### 1. Anforderungsstellung

- Neue Anforderung klären und verstehen; im Loop nachfragen, bis alles eindeutig ist (nicht raten oder annehmen).
- Fragen, ob dafür ein Ticket (GitHub Issue) angelegt werden soll, oder ob bereits eines besteht.
- Danach fragen, ob mit der Umsetzung begonnen werden soll.

### 2. Umsetzungs-Loop

- Auf Zustimmung/Anfrage hin die Anforderung (das Ticket) umsetzen.
- Prüfen, ob für das Ticket bereits ein Branch existiert, und fragen, ob dieser weiterverwendet oder neu aufgesetzt werden soll.
- Vor Beginn prüfen, ob der aktuelle Teststand (officeapp-krizzme-test.web.app) dem PROD-Stand (officeapp-krizzme.web.app) entspricht — sauberer Ausgangspunkt für die neue Umsetzung.
- Während der Umsetzung bei Änderungen/Unklarheiten nachfragen, statt eigenständig zu entscheiden.
- Nach der Umsetzung fragen, ob ein Pull Request erstellt/aktualisiert werden soll. Ein offener bzw. aktualisierter PR löst automatisch (über die bestehende CI-Pipeline `firebase-hosting-pull-request.yml`) einen Deploy auf die Testumgebung aus — kein zusätzlicher manueller Merge-Schritt auf Test nötig.
- Tickets werden sequenziell (nicht parallel) abgearbeitet, da die Testumgebung eine einzelne feste Adresse ist und ein neuerer PR-Deploy den vorherigen Teststand überschreibt.

### 3. Testbereitstellung und Merge auf PROD

- Alle Anforderungen werden auf der Testumgebung (https://officeapp-krizzme-test.web.app/) geprüft.
- Bei fehlgeschlagenem Test: Fehler analysieren, Kommentar im zugehörigen Ticket hinterlassen, zurück in den Umsetzungs-Loop (Schritt 2) — so lange, bis der Test erfolgreich ist.
- Bei erfolgreichem Test: fragen, ob der Teststand auf PROD gemergt und deployed werden soll.
- Vor dem Merge prüfen, dass der PR nur die vorgesehenen Tickets enthält (keine ungewollten Änderungen) — das eigentliche Schließen der Tickets übernimmt GitHub automatisch beim Merge (über "Fixes #Nummer" in der PR-Beschreibung).
- Der Merge löst automatisch (über die bestehende CI-Pipeline `firebase-hosting-merge.yml`) den Deploy auf PROD aus.
- Nach dem Merge den gemergten Branch aufräumen (löschen). Hinweis: Claude hat aktuell keine Berechtigung, Branches in diesem Repo selbst zu löschen (GitHub lehnt das mit 403 ab, vermutlich Repo-Ruleset "Restrict deletions") — bis das behoben ist, aktiv daran erinnern, dass der Nutzer den Branch manuell löscht.

### 4. Abschluss und Archivierung

- Nach der Übernahme auf PROD fragen, ob der Stand korrekt übernommen wurde (Abnahme durch den Nutzer).
- Falls nicht: alle Schritte über einen Quickfix erneut prüfen und ggf. durchführen (zurück in den Umsetzungs-Loop).
- Bei erfolgreicher Abnahme fragen, ob der Chat/die Session archiviert werden soll.
