// Física autoritativa del servidor (sin dependencias). Unidades: metros aprox.
const R = 2, G = 20, L = 40, W = 25, GW = 7, GH = 7, GD = 7;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const newCar = () => ({ x: 0, y: .6, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0,
  boost: 100, g: true, fl: 1, ft: 0, fdx: 0, fdy: 0, jh: false, bs: false });
const newBall = () => ({ x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0 });

function resetPos(room) {
  room.ball = newBall();
  const idx = [0, 0], n = room.mode;
  for (const p of room.players.values()) {
    const i = idx[p.team]++, c = p.car = newCar();
    const k = (i - (n - 1) / 2) * 9;
    c.x = p.team ? -k : k; c.z = p.team ? 30 : -30; c.yaw = p.team ? Math.PI : 0;
  }
}

function carStep(c, i, dt) {
  const jm = !!i.jump && !c.jh; c.jh = !!i.jump;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
  const ix = clamp(+i.x || 0, -1, 1), iy = clamp(+i.y || 0, -1, 1);
  c.bs = false;
  const boosting = i.boost && c.boost > 0;
  if (c.g) {
    let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
    if (boosting) { vf += 42 * dt; c.boost -= 33 * dt; c.bs = true; }
    else if (iy > .05) vf += (vf < 0 ? 40 : 24) * iy * dt;
    else if (iy < -.05) vf -= (vf > 0 ? 40 : 20) * -iy * dt;
    if (Math.abs(iy) <= .05 && !boosting) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    vf = clamp(vf, -18, c.bs ? 46 : Math.max(28, Math.min(vf, 46)));
    const rate = 2.7 * clamp(Math.abs(vf) / 6, 0, 1) * (1 - .3 * clamp(vf / 46, 0, 1)) * (i.drift ? 1.5 : 1);
    c.yaw -= ix * rate * dt * (vf < 0 ? -1 : 1);
    vl *= Math.exp(-(i.drift ? 1.1 : 10) * dt);
    const f2x = Math.sin(c.yaw), f2z = Math.cos(c.yaw);
    c.vx = f2x * vf + (-f2z) * vl; c.vz = f2z * vf + f2x * vl; c.vy = 0;
    c.pitch *= Math.exp(-12 * dt); c.roll *= Math.exp(-12 * dt);
    if (jm) { c.vy = 8.5; c.y = .62; c.g = false; c.fl = 1; }
  } else {
    c.vy -= G * 1.1 * dt;
    if (jm && c.fl) {
      c.fl = 0;
      if (Math.hypot(ix, iy) < .35) c.vy += 7;
      else { const s = 13; c.vx += (fx * iy + rx * ix) * s; c.vz += (fz * iy + rz * ix) * s; c.vy += 3;
        c.ft = .5; c.fdx = ix; c.fdy = iy; }
    }
    if (c.ft > 0) { c.ft -= dt; c.pitch += c.fdy * 12.6 * dt; c.roll += c.fdx * 12.6 * dt; }
    else if (i.air) { c.roll += ix * 5 * dt; c.pitch += iy * 4 * dt; }
    else { c.yaw -= ix * 3 * dt; c.pitch += iy * 4 * dt; }
    if (boosting) {
      const nx = fx * Math.cos(c.pitch), ny = -Math.sin(c.pitch), nz = fz * Math.cos(c.pitch);
      c.vx += nx * 30 * dt; c.vy += ny * 30 * dt; c.vz += nz * 30 * dt; c.boost -= 33 * dt; c.bs = true;
    }
    const sp = Math.hypot(c.vx, c.vy, c.vz); if (sp > 46) { const k = 46 / sp; c.vx *= k; c.vy *= k; c.vz *= k; }
  }
  if (!c.bs) c.boost = Math.min(100, c.boost + 6 * dt);
  c.boost = Math.max(0, c.boost);
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  if (c.y <= .6) { c.y = .6; if (c.vy < 0) c.vy = 0; if (!c.g) { c.fl = 1; c.ft = 0; } c.g = true; } else c.g = false;
  if (c.y > 19) { c.y = 19; c.vy = Math.min(c.vy, 0); }
  if (Math.abs(c.x) > W - 1) { c.x = Math.sign(c.x) * (W - 1); c.vx = 0; }
  const zl = Math.abs(c.x) < GW - 1 ? L + GD - 1 : L - 1.6;
  if (Math.abs(c.z) > zl) { c.z = Math.sign(c.z) * zl; c.vz = 0; }
}

function carBall(room, c, b) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
  const dx = b.x - c.x, dy = b.y - c.y, dz = b.z - c.z;
  const lx = dx * rx + dz * rz, lz = dx * fx + dz * fz, ly = dy;
  const cx = clamp(lx, -1, 1), cy = clamp(ly, -.5, .7), cz = clamp(lz, -1.7, 1.7);
  let ex = lx - cx, ey = ly - cy, ez = lz - cz, d = Math.hypot(ex, ey, ez);
  if (d >= R) return;
  if (d < 1e-4) { ex = 0; ey = 1; ez = 0; d = 1; }
  ex /= d; ey /= d; ez /= d;
  let nx = ex * rx + ez * fx, ny = ey * .35, nz = ex * rz + ez * fz;
  { const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m; }
  const pen = R - d;
  b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
  const rvn = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny + (b.vz - c.vz) * nz;
  if (rvn < 0) {
    const sp = Math.hypot(c.vx, c.vy, c.vz);
    const j = -(1.2) * rvn + Math.min(sp, 40) * .2;
    b.vx += nx * j; b.vy += ny * j; b.vz += nz * j;
    if (j > 4) room.ev.push({ k: 'h', x: r2(b.x), y: r2(b.y), z: r2(b.z), w: r2(Math.min(j / 30, 1)) });
  }
}

function ballStep(b, dt) {
  b.vy -= G * dt;
  const d = Math.exp(-.12 * dt); b.vx *= d; b.vy *= d; b.vz *= d;
  const sp = Math.hypot(b.vx, b.vy, b.vz); if (sp > 55) { const k = 55 / sp; b.vx *= k; b.vy *= k; b.vz *= k; }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  const e = .68;
  if (b.y < R) { b.y = R; if (b.vy < 0) b.vy = -b.vy * (Math.abs(b.vy) > 3 ? e : 0);
    const f = Math.exp(-.35 * dt); b.vx *= f; b.vz *= f; }
  if (b.y > 20 - R) { b.y = 20 - R; if (b.vy > 0) b.vy *= -e; }
  const inMouth = Math.abs(b.x) < GW - .1 && b.y < GH - R * .5;
  if (Math.abs(b.x) > W - R) { b.x = Math.sign(b.x) * (W - R); b.vx *= -e; }
  if (Math.abs(b.z) > L - R && !inMouth) { b.z = Math.sign(b.z) * (L - R); b.vz *= -e; }
  if (Math.abs(b.z) > L - R && inMouth) { // dentro de la portería
    if (Math.abs(b.x) > GW - R) { b.x = Math.sign(b.x) * (GW - R); b.vx *= -e; }
    if (b.y > GH - R && Math.abs(b.z) > L - R) { b.y = GH - R; b.vy *= -e; }
    if (Math.abs(b.z) > L + GD - R) { b.z = Math.sign(b.z) * (L + GD - R); b.vz *= -e; }
  }
}

function step(room, dt) {
  const st = room.st;
  if (st === 'lobby') return;
  room.tm -= dt;
  if (st === 'countdown') { if (room.tm <= 0) room.st = 'play'; return; }
  if (st === 'ended') { if (room.tm <= 0) room.onEnd && room.onEnd(room); return; }
  if (st === 'goal' && room.tm <= 0) { resetPos(room); room.st = 'countdown'; room.tm = 3; return; }
  if (st === 'play' && !room.ot) {
    room.time -= dt;
    if (room.time <= 0) {
      room.time = 0;
      if (room.sc[0] === room.sc[1]) room.ot = true;
      else { room.st = 'ended'; room.tm = 8; }
    }
  }
  const ps = [...room.players.values()];
  for (const p of ps) if (p.car) carStep(p.car, st === 'goal' ? {} : p.in, dt);
  const b = room.ball;
  ballStep(b, dt);
  for (const p of ps) if (p.car) carBall(room, p.car, b);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i].car, c = ps[j].car; if (!a || !c) continue;
    const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
    if (d < 2.8 && d > 1e-3 && Math.abs(c.y - a.y) < 1.5) {
      const nx = dx / d, nz = dz / d, p = (2.8 - d) / 2;
      a.x -= nx * p; a.z -= nz * p; c.x += nx * p; c.z += nz * p;
      const rv = (c.vx - a.vx) * nx + (c.vz - a.vz) * nz;
      if (rv < 0) { a.vx += nx * rv; a.vz += nz * rv; c.vx -= nx * rv; c.vz -= nz * rv; }
    }
  }
  if (st === 'play' && Math.abs(b.z) > L + .5 && Math.abs(b.x) < GW && b.y < GH) {
    const team = b.z > 0 ? 0 : 1;
    room.sc[team]++; room.ev.push({ k: 'g', team });
    if (room.ot) { room.st = 'ended'; room.tm = 8; } else { room.st = 'goal'; room.tm = 3.5; }
  }
}

function snap(room) {
  const b = room.ball, ev = room.ev; room.ev = [];
  return { t: Math.ceil(room.time), ot: room.ot, st: room.st, cd: r2(room.tm), sc: room.sc,
    b: b && [b.x, b.y, b.z, b.vx, b.vy, b.vz].map(r2),
    p: [...room.players.values()].filter(p => p.car).map(p => { const c = p.car;
      return [p.id, c.x, c.y, c.z, c.vx, c.vy, c.vz, c.yaw, c.pitch, c.roll, Math.round(c.boost), c.bs ? 1 : 0].map((v, k) => k ? r2(v) : v); }),
    ev };
}

function startMatch(room) {
  room.sc = [0, 0]; room.time = 180; room.ot = false; room.st = 'countdown'; room.tm = 4; room.ev = [];
  resetPos(room);
  for (const p of room.players.values()) p.in = {};
}

module.exports = { step, snap, startMatch, resetPos };
