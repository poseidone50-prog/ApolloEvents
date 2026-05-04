# Apollo Events

Gestionale eventi per Apollo Events — sviluppato con React + Vite + Firebase.

## Setup locale

### Prerequisiti
- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)

### Installazione

```bash
# 1. Clona il repository
git clone https://github.com/TUO_USERNAME/apollo-events.git
cd apollo-events

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente
cp .env.example .env
# Apri .env e inserisci le credenziali Firebase

# 4. Avvia il server di sviluppo
npm run dev
```

### Credenziali Firebase

Le credenziali Firebase vanno inserite nel file `.env` (non incluso nel repository per sicurezza).
Contatta l'amministratore del progetto per ottenerle.

## Workflow Git

```bash
# Prima di iniziare a lavorare — sincronizza le ultime modifiche
npm run sync:pull

# Dopo aver fatto modifiche — salva e carica su GitHub
npm run sync:push
```

## Stack tecnologico

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
