// 2인 협동 미니게임 클라이언트 공통 틀
// 서버가 보내 주는 상태(coop:state)를 받아서 그리기만 해요. 내 입력은 coop:input으로 보내요. (입력 → 상태 → 렌더링)
import { el } from './ui.js';
import { sfx, playBgm } from './audio.js';
import { dogPortrait, iconURL } from './sprites.js';
import { ITEMS } from '/shared/data.js';
import { RibbonRenderer } from './coop-ribbon.js';
import { JumpRopeRenderer } from './coop-jumprope.js';

const RENDERERS = { ribbon: RibbonRenderer, jumprope: JumpRopeRenderer };

export class CoopClient {
  // hooks: { onStart(), onEnd(result), onRetry(game) }
  constructor(socket, hooks = {}) {
    this.socket = socket;
    this.hooks = hooks;
    this.session = null;
    socket.on('coop:start', (p) => this.open(p));
    socket.on('coop:state', (p) => {
      if (!this.session || p.sid !== this.session.sid) return;
      this.syncClock(p.now);
      this.session.state = p.state;
      this.session.renderer.onState(p.state, p.events);
    });
    socket.on('coop:end', (p) => {
      if (!this.session || p.sid !== this.session.sid) return;
      this.showEnd(p);
    });
  }

  syncClock(serverNow) {
    // 서버 시각과 내 시각의 차이 (가장 작은 값이 네트워크 지연이 적은 값)
    const off = serverNow - Date.now();
    this.offset = this.offset === undefined ? off : Math.min(this.offset + 5, Math.max(this.offset - 50, off));
  }

  serverNow() { return Date.now() + (this.offset ?? 0); }

  open(p) {
    this.close();
    this.syncClock(p.now);
    const body = el('div', { class: 'coop-body' });
    const partner = p.players[p.role === 'p1' ? 'p2' : 'p1'];
    const wrap = el('div', { class: 'modal-wrap coop-wrap' },
      el('div', { class: 'modal-card coop-card' },
        el('div', { class: 'coop-head' },
          el('h2', { class: 'modal-title' }, p.name),
          el('div', { class: 'coop-players' },
            ...['p1', 'p2'].map((r) => el('span', { class: `coop-player ${r === p.role ? 'me' : ''}` },
              el('img', { class: 'pixel', src: dogPortrait(p.players[r].dog.breed, p.players[r].dog.stage, { equip: p.players[r].dog.equip }), alt: '' }),
              r === p.role ? `나 (${r === 'p1' ? '왼쪽' : '오른쪽'})` : p.players[r].nickname)))),
        body,
        el('div', { class: 'modal-buttons' }, el('button', { class: 'btn ghost', type: 'button', onclick: () => this.leave() }, '그만하기'))));
    document.getElementById('modal-root').append(wrap);
    const Renderer = RENDERERS[p.game];
    this.session = {
      sid: p.sid, game: p.game, role: p.role, players: p.players, state: p.state, wrap, partner,
      renderer: new Renderer(body, {
        role: p.role, players: p.players, state: p.state,
        send: (input) => this.socket.emit('coop:input', { sid: p.sid, input }),
        now: () => this.serverNow(),
      }),
    };
    playBgm('play');
    sfx.notify();
    this.hooks.onStart?.();
  }

  leave() {
    if (!this.session) return;
    this.socket.emit('coop:leave');
  }

  close() {
    if (!this.session) return;
    this.session.renderer.destroy();
    this.session.wrap.remove();
    this.session = null;
    playBgm('home');
  }

  showEnd(p) {
    const s = this.session;
    const mine = p.results[s.role] ?? { coins: 0 };
    const clear = p.status === 'clear';
    setTimeout(() => {
      this.close();
      if (clear) sfx.levelUp(); else sfx.bell();
      const wrap = el('div', { class: 'modal-wrap' },
        el('div', { class: 'modal-card center' },
          el('h2', { class: 'modal-title' }, clear ? '대성공!' : p.status === 'left' ? '친구가 먼저 나갔어요' : '다음에 또 해요!'),
          el('p', {}, clear ? `${s.partner.nickname}(이)랑 힘을 모아 해냈어요!` : p.status === 'left' ? '괜찮아요, 다른 친구랑 또 해 봐요.' : p.status === 'over' ? '하트를 다 썼어요. 다시 호흡을 맞춰 봐요!' : '시간이 다 됐어요. 조금만 더 하면 될 것 같아요!'),
          p.summary ? el('p', { class: 'jr-score' }, p.summary) : null,
          mine.coins ? el('p', { class: 'price center' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '' }), ` 뼈다귀 코인 +${mine.coins}`) : null,
          mine.item ? el('p', {}, '특별 선물: ', el('span', { class: 'learned' }, ITEMS[mine.item].name), ' (꾸미기에서 써 보세요)') : null,
          el('div', { class: 'modal-buttons' },
            el('button', { class: 'btn secondary', type: 'button', onclick: () => wrap.remove() }, '놀이터로'),
            el('button', { class: 'btn primary', type: 'button', onclick: () => { wrap.remove(); this.hooks.onRetry?.(s.game); } }, '한 번 더!'))));
      document.getElementById('modal-root').append(wrap);
      this.hooks.onEnd?.(p);
    }, clear ? 1800 : 400);
  }
}
