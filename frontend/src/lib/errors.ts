import { ConflictError } from '../db/repository';

// 서버/네트워크 오류를 사람이 읽을 수 있는 한국어 한 줄로 바꿉니다.
// (화면에 'API 500: {"error":...}' 같은 날것이 보이지 않도록)
export function friendlyMessage(e: unknown): string {
  if (e instanceof ConflictError) {
    return '그새 상대방이 먼저 수정했어요. 최신 내용을 확인해주세요.';
  }

  const raw = e instanceof Error ? e.message : String(e);

  // fetch 실패(네트워크 없음)
  if (/Network request failed|Failed to fetch|TypeError.*fetch/i.test(raw)) {
    return '인터넷 연결이 불안정해요. 연결을 확인하고 다시 시도해주세요.';
  }

  // request()가 만드는 'API <status>: <body>' 형식
  const m = /^API (\d{3}): ([\s\S]*)$/.exec(raw);
  if (m) {
    const status = Number(m[1]);
    let serverMsg = '';
    try {
      const body = JSON.parse(m[2]);
      serverMsg = body?.message || body?.error || '';
    } catch {
      serverMsg = m[2];
    }
    if (status === 404) return '찾을 수 없어요. 이미 삭제되었을 수 있어요.';
    if (status === 409) return serverMsg || '그새 다른 수정이 있어 처리할 수 없어요.';
    if (status >= 500) return '서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요.';
    if (status >= 400) return serverMsg || '요청을 처리할 수 없어요.';
  }

  return '문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}
