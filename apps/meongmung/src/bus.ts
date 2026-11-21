// 화면(HTML)과 게임(Phaser)이 서로 말을 주고받는 작은 통로
type Handler = (detail?: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

export const bus = {
  on(name: string, fn: Handler) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name)!.add(fn);
    return () => handlers.get(name)!.delete(fn);
  },
  emit(name: string, detail?: unknown) { handlers.get(name)?.forEach((fn) => fn(detail)); },
};

// 게임 → 화면: 'dog:tapped' 'care:done'
// 화면 → 게임: 'care' { kind } , 'scene:music'
