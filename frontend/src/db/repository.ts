import {
  Sheet,
  Tab,
  TabDetail,
  CellInfo,
  ColumnFormat,
  Merge,
  HistoryEntry,
  EventItem,
  EventLink,
  MemoSummary,
  Memo,
} from '../types';
import { getCachedEditorName } from '../lib/identity';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

// 상대방이 먼저 같은 셀을 고쳤을 때 서버가 409로 돌려주는 정보.
export interface ConflictCurrent {
  row: number;
  col: number;
  value: string;
  formula?: string;
  computed: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface MemoConflictCurrent {
  id: string;
  title: string;
  content: string;
  updatedAt?: number;
  updatedBy?: string;
}

export class ConflictError extends Error {
  current: unknown;
  constructor(current: unknown) {
    super('conflict');
    this.name = 'ConflictError';
    this.current = current;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const editor = getCachedEditorName();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // HTTP 헤더는 ASCII만 안전 → 한글 이름 등을 인코딩해서 보냅니다(서버가 디코딩).
      ...(editor ? { 'X-Editor': encodeURIComponent(editor) } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 409) {
    let body: { error?: string; current?: unknown } | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (body?.error === 'conflict') {
      throw new ConflictError(body.current ?? null);
    }
    throw new Error(`API 409: ${body?.error ?? 'conflict'}`);
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

// 클라우드에 올린 백엔드 서버(backend/)를 호출합니다. 서버 주소는 EXPO_PUBLIC_API_URL 환경변수로 설정합니다.
export const api = {
  getSheets(): Promise<Sheet[]> {
    return request('/api/sheets');
  },

  createSheet(name: string): Promise<Sheet> {
    return request('/api/sheets', { method: 'POST', body: JSON.stringify({ name }) });
  },

  renameSheet(sheetId: string, name: string): Promise<Sheet> {
    return request(`/api/sheets/${sheetId}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  deleteSheet(sheetId: string): Promise<void> {
    return request(`/api/sheets/${sheetId}`, { method: 'DELETE' });
  },

  reorderSheets(orderedIds: string[]): Promise<Sheet[]> {
    return request('/api/sheets/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) });
  },

  getTabs(sheetId: string): Promise<Tab[]> {
    return request(`/api/sheets/${sheetId}/tabs`);
  },

  createTab(sheetId: string, name: string, rows = 15, cols = 5): Promise<Tab> {
    return request(`/api/sheets/${sheetId}/tabs`, {
      method: 'POST',
      body: JSON.stringify({ name, rows, cols }),
    });
  },

  reorderTabs(sheetId: string, orderedIds: string[]): Promise<Tab[]> {
    return request(`/api/sheets/${sheetId}/tabs/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) });
  },

  getTab(tabId: string): Promise<TabDetail> {
    return request(`/api/tabs/${tabId}`);
  },

  renameTab(tabId: string, name: string): Promise<Tab> {
    return request(`/api/tabs/${tabId}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  deleteTab(tabId: string): Promise<void> {
    return request(`/api/tabs/${tabId}`, { method: 'DELETE' });
  },

  insertRow(tabId: string, index: number): Promise<Tab> {
    return request(`/api/tabs/${tabId}/rows`, { method: 'POST', body: JSON.stringify({ index }) });
  },

  insertColumn(tabId: string, index: number): Promise<Tab> {
    return request(`/api/tabs/${tabId}/columns`, { method: 'POST', body: JSON.stringify({ index }) });
  },

  deleteRow(tabId: string, index: number): Promise<Tab> {
    return request(`/api/tabs/${tabId}/rows/${index}`, { method: 'DELETE' });
  },

  deleteColumn(tabId: string, index: number): Promise<Tab> {
    return request(`/api/tabs/${tabId}/columns/${index}`, { method: 'DELETE' });
  },

  undoLastDelete(tabId: string): Promise<Tab> {
    return request(`/api/tabs/${tabId}/undo-delete`, { method: 'POST' });
  },

  // baseUpdatedAt: 이 셀을 화면에 불러왔을 때의 updatedAt. 넘기면 서버가 그 사이 남이 고쳤는지 확인하고,
  // 고쳤으면 ConflictError를 던집니다. undefined면 확인 없이 덮어씁니다(첫 입력 등).
  updateCell(
    tabId: string,
    row: number,
    col: number,
    value: string,
    formula?: string,
    baseUpdatedAt?: number | null
  ): Promise<CellInfo> {
    const body: Record<string, unknown> = { row, col, value, formula };
    if (baseUpdatedAt !== undefined) body.baseUpdatedAt = baseUpdatedAt;
    return request(`/api/tabs/${tabId}/cells`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  getHistory(tabId: string, limit = 30): Promise<HistoryEntry[]> {
    return request(`/api/tabs/${tabId}/history?limit=${limit}`);
  },

  revertHistory(tabId: string, historyId: number): Promise<{ ok: boolean; row: number; col: number }> {
    return request(`/api/tabs/${tabId}/history/${historyId}/revert`, { method: 'POST' });
  },

  setColumnFormat(tabId: string, col: number, format: ColumnFormat): Promise<{ col: number; format: ColumnFormat }> {
    return request(`/api/tabs/${tabId}/columns/${col}/format`, {
      method: 'PUT',
      body: JSON.stringify({ format }),
    });
  },

  setMerge(tabId: string, anchorRow: number, anchorCol: number, rowSpan: number, colSpan: number): Promise<Merge> {
    return request(`/api/tabs/${tabId}/merges`, {
      method: 'PUT',
      body: JSON.stringify({ anchorRow, anchorCol, rowSpan, colSpan }),
    });
  },

  setColumnWidth(tabId: string, col: number, width: number | null): Promise<{ col: number; width: number | null }> {
    return request(`/api/tabs/${tabId}/columns/${col}/width`, {
      method: 'PUT',
      body: JSON.stringify({ width }),
    });
  },

  // ── 메인화면: 기념일 / D-day ──
  async getEvents(): Promise<EventItem[]> {
    // 서버 버전이 낮아 links가 없을 수도 있어 항상 배열로 맞춰줍니다.
    const list = await request<EventItem[]>('/api/events');
    return list.map((e) => ({ ...e, links: e.links ?? [] }));
  },

  createEvent(title: string, date: string): Promise<EventItem> {
    return request('/api/events', { method: 'POST', body: JSON.stringify({ title, date }) });
  },

  updateEvent(id: string, patch: { title?: string; date?: string }): Promise<EventItem> {
    return request(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
  },

  deleteEvent(id: string): Promise<void> {
    return request(`/api/events/${id}`, { method: 'DELETE' });
  },

  setEventLinks(id: string, links: EventLink[]): Promise<EventItem> {
    return request(`/api/events/${id}/links`, { method: 'PUT', body: JSON.stringify({ links }) });
  },

  // ── 공유 메모장 ──
  getMemos(): Promise<MemoSummary[]> {
    return request('/api/memos');
  },

  getMemo(id: string): Promise<Memo> {
    return request(`/api/memos/${id}`);
  },

  createMemo(title: string): Promise<Memo> {
    return request('/api/memos', { method: 'POST', body: JSON.stringify({ title }) });
  },

  updateMemo(
    id: string,
    patch: { title?: string; content?: string },
    baseUpdatedAt?: number | null
  ): Promise<Memo> {
    const body: Record<string, unknown> = { ...patch };
    if (baseUpdatedAt !== undefined) body.baseUpdatedAt = baseUpdatedAt;
    return request(`/api/memos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  deleteMemo(id: string): Promise<void> {
    return request(`/api/memos/${id}`, { method: 'DELETE' });
  },
};
