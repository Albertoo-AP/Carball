const express = require('express'), http = require('http'), { Server } = require('socket.io');
const game = require('./game');
const app = express();
app.get('/', (_, res) => res.sendFile(__dirname + '/index.html'));
app.get('/health', (_, res) => res.send('ok'));
const srv = http.createServer(app);
const io = new Server(srv, { cors: { origin: '*' }, pingInterval: 5000, pingTimeout: 8000 });
const rooms = new Map();
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => { let c; do { c = Array.from({ length: 4 }, () => CH[Math.random() * CH.length | 0]).join(''); } while (rooms.has(c)); return c; };

function lobbyMsg(r) {
  return { code: r.code, mode: r.mode, host: r.host, st: r.st === 'lobby' ? 'lobby' : 'game',
    players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, style: p.style, team: p.team })) };
}
const sendLobby = r => io.to(r.code).emit('lobby', lobbyMsg(r));
function toLobby(r) { r.st = 'lobby'; r.ball = null; for (const p of r.players.values()) p.car = null; sendLobby(r); }
function begin(r) { game.startMatch(r); io.to(r.code).emit('start', lobbyMsg(r)); sendLobby(r); }

function mkRoom(mode, pub) {
  const r = { code: code(), mode, pub, host: null, players: new Map(), st: 'lobby', ball: null,
    sc: [0, 0], time: 180, tm: 0, ot: false, ev: [], onEnd: toLobby };
  rooms.set(r.code, r); return r;
}
const count = (r, t) => [...r.players.values()].filter(p => p.team === t).length;

io.on('connection', s => {
  let room = null;
  const prof = d => ({ id: s.id, name: String(d && d.name || 'Jugador').slice(0, 14),
    color: /^#[0-9a-f]{6}$/i.test(d && d.color) ? d.color : '#ff5a1f', style: [0, 1, 2].includes(d && d.style) ? d.style : 0, in: {}, car: null });
  const enter = (r, d) => {
    if (r.players.size >= r.mode * 2) return 'Sala llena';
    if (r.st !== 'lobby') return 'La partida ya ha empezado';
    const p = prof(d); p.team = count(r, 0) <= count(r, 1) ? 0 : 1;
    if (count(r, p.team) >= r.mode) p.team = 1 - p.team;
    r.players.set(s.id, p); if (!r.host) r.host = s.id;
    room = r; s.join(r.code); sendLobby(r);
    if (r.pub && r.players.size === r.mode * 2) begin(r);
    return null;
  };
  const leave = () => {
    if (!room) return; const r = room; room = null;
    s.leave(r.code); r.players.delete(s.id);
    if (!r.players.size) { rooms.delete(r.code); return; }
    if (r.host === s.id) r.host = r.players.keys().next().value;
    sendLobby(r);
  };
  s.on('create', (d, cb) => { leave(); const m = [1, 2, 3].includes(d && d.mode) ? d.mode : 1;
    const r = mkRoom(m, false); enter(r, d); cb && cb({ ok: true, code: r.code }); });
  s.on('join', (d, cb) => { leave(); const r = rooms.get(String(d && d.code || '').toUpperCase().trim());
    if (!r) return cb && cb({ ok: false, err: 'Sala no encontrada' });
    const e = enter(r, d); cb && cb(e ? { ok: false, err: e } : { ok: true, code: r.code }); });
  s.on('quick', (d, cb) => { leave(); const m = [1, 2, 3].includes(d && d.mode) ? d.mode : 1;
    let r = [...rooms.values()].find(x => x.pub && x.st === 'lobby' && x.mode === m && x.players.size < m * 2) || mkRoom(m, true);
    enter(r, d); cb && cb({ ok: true, code: r.code }); });
  s.on('team', () => { const p = room && room.players.get(s.id);
    if (p && room.st === 'lobby' && count(room, 1 - p.team) < room.mode) { p.team = 1 - p.team; sendLobby(room); } });
  s.on('start', () => { if (room && room.host === s.id && room.st === 'lobby') begin(room); });
  s.on('input', d => { const p = room && room.players.get(s.id); if (p && d) p.in = d; });
  s.on('leave', leave);
  s.on('disconnect', leave);
});

let tick = 0, last = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min((now - last) / 1000, .05); last = now; tick++;
  for (const r of rooms.values()) {
    if (r.st === 'lobby') continue;
    game.step(r, dt);
    if (tick % 2 === 0 || r.ev.length) io.to(r.code).volatile.emit('s', game.snap(r));
  }
}, 1000 / 60);
srv.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto', process.env.PORT || 3000));
