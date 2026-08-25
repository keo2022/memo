import { Menu, Sheet, SheetDetail, CellInfo, ColumnFormat, Merge } from '../types';

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
  getMenus(): Promise<Menu[]> {
    return request('/api/menus');
  },

  createMenu(name: string): Promise<Menu> {
    return request('/api/menus', { method: 'POST', body: JSON.stringify({ name }) });
  },

  renameMenu(menuId: string, name: string): Promise<Menu> {
    return request(`/api/menus/${menuId}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  deleteMenu(menuId: string): Promise<void> {
    return request(`/api/menus/${menuId}`, { method: 'DELETE' });
  },

  getSheets(menuId: string): Promise<Sheet[]> {
    return request(`/api/menus/${menuId}/sheets`);
  },

  createSheet(menuId: string, name: string, rows = 15, cols = 5): Promise<Sheet> {
    return request(`/api/menus/${menuId}/sheets`, {
      method: 'POST',
      body: JSON.stringify({ name, rows, cols }),
    });
  },

  getSheet(sheetId: string): Promise<SheetDetail> {
    return request(`/api/sheets/${sheetId}`);
  },

  renameSheet(sheetId: string, name: string): Promise<Sheet> {
    return request(`/api/sheets/${sheetId}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  deleteSheet(sheetId: string): Promise<void> {
    return request(`/api/sheets/${sheetId}`, { method: 'DELETE' });
  },

  insertRow(sheetId: string, index: number): Promise<Sheet> {
    return request(`/api/sheets/${sheetId}/rows`, { method: 'POST', body: JSON.stringify({ index }) });
  },

  insertColumn(sheetId: string, index: number): Promise<Sheet> {
    return request(`/api/sheets/${sheetId}/columns`, { method: 'POST', body: JSON.stringify({ index }) });
  },

  updateCell(sheetId: string, row: number, col: number, value: string, formula?: string): Promise<CellInfo> {
    return request(`/api/sheets/${sheetId}/cells`, {
      method: 'PUT',
      body: JSON.stringify({ row, col, value, formula }),
    });
  },

  setColumnFormat(sheetId: string, col: number, format: ColumnFormat): Promise<{ col: number; format: ColumnFormat }> {
    return request(`/api/sheets/${sheetId}/columns/${col}/format`, {
      method: 'PUT',
      body: JSON.stringify({ format }),
    });
  },

  setMerge(sheetId: string, anchorRow: number, anchorCol: number, rowSpan: number, colSpan: number): Promise<Merge> {
    return request(`/api/sheets/${sheetId}/merges`, {
      method: 'PUT',
      body: JSON.stringify({ anchorRow, anchorCol, rowSpan, colSpan }),
    });
  },

  setColumnWidth(sheetId: string, col: number, width: number | null): Promise<{ col: number; width: number | null }> {
    return request(`/api/sheets/${sheetId}/columns/${col}/width`, {
      method: 'PUT',
      body: JSON.stringify({ width }),
    });
  },
};
