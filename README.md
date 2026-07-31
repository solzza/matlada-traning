# Matlådsdashboard

En lokal dashboard för att planera matlådor, menyer, inköp och makro.

## Starta lokalt

Öppna PowerShell i projektmappen och kör:

```powershell
cd dashboard
node server.js
```

Appen öppnas på:

```text
http://127.0.0.1:5173/
```

## Mobiltest på samma Wi-Fi

För att kunna öppna appen från mobilen behöver servern lyssna på datorns nätverksadress i stället för bara `127.0.0.1`.

Ändra `server.js` från:

```js
server.listen(port, "127.0.0.1", () => {
```

till:

```js
server.listen(port, "0.0.0.0", () => {
```

Starta om servern och öppna sedan:

```text
http://DIN-DATOR-IP:5173/
```

## PWA

Dashboarden har manifest, service worker och appikoner, så den kan publiceras som en installerbar PWA via en HTTPS-host som GitHub Pages, Cloudflare Pages, Netlify eller Vercel.
