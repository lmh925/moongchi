// 서버 API 호출
const TOKEN_KEY = 'meongmung.token';

function load() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

let token = load();

export function getToken() { return token; }

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
  } catch { /* 저장소를 못 써도 이번 접속 동안은 괜찮아요 */ }
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('인터넷 연결을 확인해 주세요!', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? '앗, 문제가 생겼어요.', res.status);
  return data;
}

export const post = (path, body = {}) => api(path, { method: 'POST', body });
