import { Sheet, Tab, TabDetail, CellInfo, ColumnFormat, Merge } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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

  updateCell(tabId: string, row: number, col: number, value: string, formula?: string): Promise<CellInfo> {
    return request(`/api/tabs/${tabId}/cells`, {
      method: 'PUT',
      body: JSON.stringify({ row, col, value, formula }),
    });
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
};
