import db from './database';
import { evaluateFormula } from './formula';
import { Menu, Sheet, SheetDetail, CellInfo } from '../types';

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

interface RawCell {
  value: string;
  formula?: string;
}

function computeCell(
  row: number,
  col: number,
  cellsMap: Map<string, RawCell>,
  cache: Map<string, number>
): number {
  const key = `${row}_${col}`;
  if (cache.has(key)) return cache.get(key)!;

  const cell = cellsMap.get(key);
  if (!cell) return 0;

  if (cell.formula) {
    const value = evaluateFormula(cell.formula, (r, c) => computeCell(r, c, cellsMap, cache));
    cache.set(key, value);
    return value;
  }

  const num = Number(cell.value);
  const value = cell.value !== '' && !isNaN(num) ? num : 0;
  cache.set(key, value);
  return value;
}

function loadCellsMap(sheetId: string): Map<string, RawCell> {
  const rows = db.getAllSync<{ row: number; col: number; value: string; formula: string | null }>(
    'SELECT row, col, value, formula FROM cells WHERE sheet_id = ?',
    [sheetId]
  );
  const map = new Map<string, RawCell>();
  rows.forEach((c) => {
    map.set(`${c.row}_${c.col}`, { value: c.value, formula: c.formula ?? undefined });
  });
  return map;
}

// 백엔드 서버 없이, 폰에 내장된 SQLite에 직접 읽고 씁니다.
// (기존 api 객체와 동일한 모양이라 화면 코드는 그대로 사용 가능)
export const api = {
  async getMenus(): Promise<Menu[]> {
    const rows = db.getAllSync<{ id: string; name: string; order_num: number }>(
      'SELECT id, name, order_num FROM menus ORDER BY order_num ASC'
    );
    return rows.map((r) => ({ id: r.id, name: r.name, order: r.order_num }));
  },

  async createMenu(name: string): Promise<Menu> {
    const countRow = db.getFirstSync<{ c: number }>('SELECT COUNT(*) as c FROM menus');
    const order = countRow?.c ?? 0;
    const id = genId();
    db.runSync('INSERT INTO menus (id, name, order_num) VALUES (?, ?, ?)', [id, name, order]);
    return { id, name, order };
  },

  async getSheets(menuId: string): Promise<Sheet[]> {
    const rows = db.getAllSync<{ id: string; menu_id: string; name: string; rows: number; cols: number }>(
      'SELECT id, menu_id, name, rows, cols FROM sheets WHERE menu_id = ?',
      [menuId]
    );
    return rows.map((r) => ({ id: r.id, menuId: r.menu_id, name: r.name, rows: r.rows, cols: r.cols }));
  },

  async createSheet(menuId: string, name: string, rows = 10, cols = 6): Promise<Sheet> {
    const id = genId();
    db.runSync('INSERT INTO sheets (id, menu_id, name, rows, cols) VALUES (?, ?, ?, ?, ?)', [
      id,
      menuId,
      name,
      rows,
      cols,
    ]);
    return { id, menuId, name, rows, cols };
  },

  async getSheet(sheetId: string): Promise<SheetDetail> {
    const sheetRow = db.getFirstSync<{
      id: string;
      menu_id: string;
      name: string;
      rows: number;
      cols: number;
    }>('SELECT id, menu_id, name, rows, cols FROM sheets WHERE id = ?', [sheetId]);
    if (!sheetRow) throw new Error('sheet not found');

    const cellsMap = loadCellsMap(sheetId);
    const cache = new Map<string, number>();
    const grid: CellInfo[] = [];
    for (let r = 0; r < sheetRow.rows; r++) {
      for (let c = 0; c < sheetRow.cols; c++) {
        const cell = cellsMap.get(`${r}_${c}`);
        grid.push({
          row: r,
          col: c,
          value: cell?.value ?? '',
          formula: cell?.formula,
          computed: computeCell(r, c, cellsMap, cache),
        });
      }
    }

    return {
      id: sheetRow.id,
      menuId: sheetRow.menu_id,
      name: sheetRow.name,
      rows: sheetRow.rows,
      cols: sheetRow.cols,
      cells: grid,
    };
  },

  async updateCell(sheetId: string, row: number, col: number, value: string, formula?: string): Promise<CellInfo> {
    db.runSync(
      `INSERT INTO cells (sheet_id, row, col, value, formula) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sheet_id, row, col) DO UPDATE SET value = excluded.value, formula = excluded.formula`,
      [sheetId, row, col, value, formula ?? null]
    );

    const cellsMap = loadCellsMap(sheetId);
    const cache = new Map<string, number>();
    const computed = computeCell(row, col, cellsMap, cache);
    return { row, col, value, formula, computed };
  },
};
