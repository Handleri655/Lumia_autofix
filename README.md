# Lumia Autofix

Nettisivut yritykselle Lumia Autofix (Fixbest Oy) — pieni ammattitaitoinen autokorjaamo Metsälässä.

Sivusto näyttää **suuntaa antavat palveluhinnat** ja **tarjoukset** SQLite-tietokannasta. Asiakas voi muokata niitä admin-portaalissa (`/admin`).

## Käynnistys (kehitys)

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run seed
npm run dev
```

- Julkinen sivu: http://127.0.0.1:5173/
- Admin: http://127.0.0.1:5173/admin/
- API: http://127.0.0.1:3001/

Oletussalasana on `.env`-tiedoston `ADMIN_PASSWORD` (esim. `vaihda-tama`).

## Tuotanto (oma palvelin)

```bash
npm run build
npm start
```

Palvelin tarjoilee buildatun sivuston, adminin ja API:n samasta portista (`PORT`, oletus 3001). Tietokanta: `data/lumia.db`.

## Vercel

Vercelissä julkinen sivu lukee palvelut ja tarjoukset API-reitistä / staattisesta katalogista (`public/data/`).

### Ympäristömuuttujat (Vercel → Settings → Environment Variables)

1. `ADMIN_PASSWORD` — admin-kirjautumisen salasana (**pakollinen**)
2. Blob-store `lumia-autofix-blob` yhdistettynä projektiin  
   (Storage → Blob → Connect to Project). Token/`BLOB_READ_WRITE_TOKEN` tulee yleensä automaattisesti.

Private Blob käy — katalogi luetaan/kirjoitetaan palvelimella (`get` / `put`, access: private).

Kun Blob on kytketty: adminissa tallennettu hinta näkyy julkisella sivulla heti (ilman uutta deployta).
```bash
npm run export-catalog   # synkkaa SQLite → JSON ennen deployta (valinnainen)
git push
```## Admin

1. Avaa `/admin`
2. Kirjaudu salasanalla
3. **Tarjoukset:** lisää / muokkaa / piilota / poista — näkyvät sivulla ennen palveluita
4. **Palveluhinnat:** muokkaa vapaatekstiä (esim. `Alk. 89 €`, `Pyydä tarjous`)
5. Tallenna — muutokset näkyvät heti julkisella sivulla

## Huomio

Yhteydenottolomake avaa sähköpostin osoitteeseen `info@lumiaautofix.fi`. Vaihda osoite tiedostossa `src/main.js` (`CONTACT_EMAIL`), kun oikea sähköposti on tiedossa.
