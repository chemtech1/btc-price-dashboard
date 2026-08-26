# Crypto Preis Dashboard

Next.js-Webapp für aktuelle Krypto-Preise in **EUR** und historischen Verlauf als Chart.

- Datenquelle: **Binance** Spot Market Data (kein API-Key)
- Nur Handelspaare mit Quote **EUR** (z. B. `BTCEUR`, `ETHEUR`)
- Standard-Coin: Bitcoin (`BTCEUR`)
- Weitere Coins über das **Coins-Menü** (Watchlist auf dem Server, alle Geräte)
- Verlauf: Umschalter **Linie** / **Kerzen**
- Linie: 5 Min, 15 Min (1s), 1 Std, Tag, Woche, Monat, 6 Monate, Jahr, Alles
- Kerzen: Intervalle **1m · 5m · 15m · 30m · 1h · 5h · 1D · 1W · 1M** (je **60** Kerzen; `5h` aus 1h aggregiert)
- Kerzen-Live-Update: **1 Sekunde** in jeder Ansicht

## Voraussetzungen

- Node.js 20+

## Lokal starten

```bash
cd btc-price-dashboard
npm install
npm run dev
```

Browser: [http://localhost:3000](http://localhost:3000)

Optional: andere Binance-Basis-URL (z. B. wenn `api.binance.com` blockiert ist) und DB-Pfad:

```bash
# .env.local
BINANCE_API_BASE=https://data-api.binance.vision
CRYPTO_DB_PATH=/var/lib/crypto-dashboard/crypto.db
```

Ohne `CRYPTO_DB_PATH` liegt die SQLite-Datei unter `data/crypto.db` im Projektverzeichnis.

## Produktion

```bash
npm ci
npm run build
npm start
```

Lauscht auf `0.0.0.0:3000` → `http://<SERVER-IP>:3000`

## Deploy auf Proxmox (Kurzfassung)

1. LXC/VM mit Node.js 20+ und LAN-IP.
2. Projekt unter `/data/btc-price-dashboard` bauen (`npm ci && npm run build`).
3. systemd-Unit aus `deploy/crypto-dashboard.service` (User `root`, WorkingDirectory `/data/btc-price-dashboard`).
4. Port **3000/tcp** freigeben.
5. Zugriff: `http://<LXC-oder-VM-IP>:3000`

```bash
cp /data/btc-price-dashboard/deploy/crypto-dashboard.service /etc/systemd/system/crypto-dashboard.service
# Falls npm start noch im Terminal läuft: stoppen (Port 3000)
# which npm  →  bei nvm/fnm ExecStart in der Unit auf den vollen Pfad setzen
systemctl daemon-reload
systemctl enable --now crypto-dashboard.service
systemctl status crypto-dashboard.service
```

## Nutzung

1. Startseite zeigt `BTCEUR`-Preis und Chart.
2. **Coins** → suchen (Ticker wie `ETH`) → **+ Add**.
3. Coin antippen → Preis und Chart wie bei BTC.
4. Nur Paare mit echtem Binance-EUR-Markt erscheinen in der Suche.

## Hinweise

- Watchlist liegt in **SQLite** auf dem Server (`GET`/`PUT /api/watchlist`) und zusätzlich in `localStorage` als Fallback. Alle Geräte dieser Installation teilen die Liste; sie bleibt nach Browser-Close erhalten.
- Marktdaten (EUR-Paare, Ticker, Kerzen) werden lokal in **SQLite** gespeichert und von Binance nachgezogen.
- Beim Seitenaufruf und gestaffelt im Hintergrund (Ticker ~1 Min, Tages-History ~15 Min, Prune ~1 Std) werden Daten nachgezogen.
- **1-Sekunden-Kerzen** nur on-demand für „5 Min“/„15 Min“, nicht im Hintergrund; Aufbewahrung ca. 2 Stunden.
- Chart zeigt Close-Preise aus gespeicherten Klines; Tageskerzen bleiben dauerhaft, feinere Intervalle werden periodisch bereinigt.
- Manueller Sync (Debug): `POST /api/sync?symbols=BTCEUR` oder `POST /api/sync?full=1`.
- Für `better-sqlite3` auf dem Server ggf. Build-Tools nötig (`build-essential` o. Ä.).
