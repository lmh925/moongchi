// 놀이터 부하 테스트: 가짜 강아지 N마리가 놀이터에서 계속 뛰어다닐 때 서버가 버티는지 재요.
// 사용법: node --no-warnings scripts/loadtest.js [강아지 수=100] [초=20]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { openDb } from '../server/db.js';
import { Auth } from '../server/auth.js';
import { Game } from '../server/game.js';

const N = Number(process.argv[2] ?? 100);
const SECONDS = Number(process.argv[3] ?? 20);
const PORT = 4900 + Math.floor(Math.random() * 90);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmload-'));
const dbFile = path.join(dir, 'load.db');

// 1) 계정과 강아지를 미리 만들어 둬요 (가입 속도 제한을 피하려고 DB에 바로)
const db = openDb(dbFile);
const auth = new Auth(db);
const game = new Game(db);
const breeds = ['bichon', 'pomeranian', 'poodle', 'maltese', 'corgi', 'shiba'];
const tokens = [];
const syl = '가나다라마바사아자하구누두루무부수우주후';
for (let i = 0; i < N; i++) {
  const nick = `부하${syl[Math.floor(i / 20) % 20]}${syl[i % 20]}${Math.floor(i / 400) || ''}`;
  const { userId, token } = auth.signup(nick, '1234');
  game.createDog(userId, { name: '멍', breed: breeds[i % 6], personality: 'hyper' });
  tokens.push(token);
}
db.close();

// 2) 서버를 따로 띄워요
const server = spawn(process.execPath, ['--no-warnings', 'server/index.js'], { env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => server.stdout.once('data', r));

const cpuTicks = () => {
  const f = fs.readFileSync(`/proc/${server.pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return Number(f[11]) + Number(f[12]);
};
const rssMb = () => {
  const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${server.pid}/status`, 'utf8'));
  return m ? Number(m[1]) / 1024 : 0;
};

// 3) 강아지들이 접속해서 놀이터에 들어가요
const clients = [];
let received = 0; let bytes = 0;
for (const token of tokens) {
  const s = io(`http://localhost:${PORT}`, { auth: { token }, transports: ['websocket'] });
  s.onAny((ev, payload) => { received += 1; bytes += JSON.stringify(payload ?? '').length + ev.length; });
  clients.push(s);
}
await Promise.all(clients.map((s) => new Promise((r) => s.on('connect', r))));
await Promise.all(clients.map((s) => new Promise((r) => s.emit('plaza:join', {}, r))));

// 4) 모두 초당 10번 위치를 보내며 돌아다니고, 가끔 스티커와 몸짓을 해요
const pings = [];
const state = clients.map(() => ({ x: 100 + Math.random() * 280, y: 100 + Math.random() * 160, a: Math.random() * 6.28 }));
const mover = setInterval(() => {
  clients.forEach((s, i) => {
    const st = state[i];
    st.a += (Math.random() - 0.5) * 0.6;
    st.x = Math.min(460, Math.max(20, st.x + Math.cos(st.a) * 6));
    st.y = Math.min(340, Math.max(20, st.y + Math.sin(st.a) * 6));
    s.emit('plaza:pos', { x: st.x, y: st.y, dir: Math.cos(st.a) > 0 ? 1 : -1, moving: true });
    if (Math.random() < 0.01) s.emit('plaza:sticker', { id: 'heart' });
    if (Math.random() < 0.01) s.emit('plaza:emote', { kind: 'jump' });
  });
}, 100);
const pinger = setInterval(() => {
  const s = clients[Math.floor(Math.random() * clients.length)];
  const t = performance.now();
  s.emit('plaza:channels', {}, () => pings.push(performance.now() - t));
}, 50);

await new Promise((r) => setTimeout(r, 2000)); // 워밍업
received = 0; bytes = 0; pings.length = 0;
const c0 = cpuTicks(); const t0 = performance.now();
await new Promise((r) => setTimeout(r, SECONDS * 1000));
const c1 = cpuTicks(); const t1 = performance.now();
clearInterval(mover); clearInterval(pinger);

const hz = os.constants ? 100 : 100; // Linux 기본 클럭 틱
const cpu = ((c1 - c0) / hz) / ((t1 - t0) / 1000) * 100;
pings.sort((a, b) => a - b);
const pct = (p) => pings[Math.min(pings.length - 1, Math.floor(pings.length * p))]?.toFixed(1);
const secs = (t1 - t0) / 1000;
const channels = Math.ceil(N / 20);
console.log(JSON.stringify({
  dogs: N, channels, seconds: SECONDS,
  serverCpuPercentOfOneCore: Math.round(cpu),
  serverMemoryMb: Math.round(rssMb()),
  responseMs: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99) },
  messagesPerDogPerSec: Math.round(received / N / secs),
  downloadKbPerDogPerSec: Math.round((bytes / N / secs / 1024) * 10) / 10,
}, null, 2));
clients.forEach((s) => s.close());
server.kill();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(0);
