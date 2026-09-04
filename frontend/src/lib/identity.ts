import AsyncStorage from '@react-native-async-storage/async-storage';

// 로그인은 없고, 이 기기를 쓰는 사람 이름만 저장해서 편집 기록에 "누가"를 남깁니다.
const KEY = 'memo.editorName';

let cached: string | null = null;

export async function loadEditorName(): Promise<string | null> {
  if (cached) return cached;
  try {
    cached = await AsyncStorage.getItem(KEY);
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveEditorName(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 40);
  cached = trimmed || null;
  try {
    if (trimmed) await AsyncStorage.setItem(KEY, trimmed);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // 저장 실패해도 이번 세션 동안은 cached 값으로 동작합니다.
  }
}

// 네트워크 요청 헤더에 넣을 때 동기적으로 필요해서 캐시된 값을 바로 돌려줍니다.
export function getCachedEditorName(): string | null {
  return cached;
}
