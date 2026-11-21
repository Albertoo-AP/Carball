# Car Ball Arena
Fútbol con coches 3D multijugador. Servidor autoritativo (Node + Socket.IO), cliente Three.js, controles táctiles.

## Local
    npm install
    npm start        # http://localhost:3000
Para probar con móviles sin desplegar: `npx cloudflared tunnel --url http://localhost:3000` (o ngrok) y abre el https que te da.

## Desplegar (Render.com, gratis)
1. Sube esta carpeta a un repo de GitHub.
2. Render → New → Web Service → tu repo. Build: `npm install`  Start: `npm start`.
3. Abre la URL https://xxxx.onrender.com en el móvil. Comparte el código de sala o el enlace.
(Railway, Fly.io o cualquier VPS con Node 18+ también valen; usa la variable PORT.)
