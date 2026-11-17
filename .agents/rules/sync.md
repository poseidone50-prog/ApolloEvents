---
trigger: always_on
description: Sincronizzazione automatica GitHub tra i due PC per Apollo Events
---
# Sincronizzazione Automatica Multi-PC (Apollo Events)

1. **Prima di iniziare qualsiasi modifica**: esegui sempre `git pull --rebase --autostash origin main` per scaricare eventuali modifiche fatte dall'altro PC.
2. **Al termine di ogni modifica richiesta dall'utente**: esegui sempre `git add -A`, `git commit -m "..."` e `git push origin main` in automatico senza che l'utente debba chiederlo.
