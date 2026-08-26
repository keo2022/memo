import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { Sheet, Tab, CellData, ColumnFormat, Merge } from '../types';
import { shiftFormulaRefs } from '../formula/shiftRefs';

// 클라우드에 영구 디스크(volume)를 붙였다면 DB_PATH 환경변수로 그 경로를 가리키게 하세요.
// (예: Fly.io에서 볼륨을 /data에 마운트했다면 DB_PATH=/data/db.sqlite)
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'db.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

function tableExists(name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  return cols.some((c) => c.name === column);
}

// 예전 스키마(menus/sheets)에서 이름이 바뀐 새 스키마(sheets/tabs)로 기존 데이터를 옮깁니다.
// 옛 "sheets" 테이블부터 "tabs"로 옮겨 이름을 비운 뒤에 옛 "menus" 테이블을 "sheets"로 옮깁니다.
if (tableExists('sheets') && columnExists('sheets', 'menu_id') && !tableExists('tabs')) {
  db.exec('ALTER TABLE sheets RENAME TO tabs');
  db.exec('ALTER TABLE tabs RENAME COLUMN menu_id TO sheet_id');
}
if (tableExists('cells') && columnExists('cells', 'sheet_id')) {
  db.exec('ALTER TABLE cells RENAME COLUMN sheet_id TO tab_id');
}
if (tableExists('column_formats') && columnExists('column_formats', 'sheet_id')) {
  db.exec('ALTER TABLE column_formats RENAME COLUMN sheet_id TO tab_id');
}
if (tableExists('merges') && columnExists('merges', 'sheet_id')) {
  db.exec('ALTER TABLE merges RENAME COLUMN sheet_id TO tab_id');
}
if (tableExists('menus') && !tableExists('sheets')) {
  db.exec('ALTER TABLE menus RENAME TO sheets');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_num INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tabs (
    id TEXT PRIMARY KEY,
    sheet_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cells (
    tab_id TEXT NOT NULL,
    row INTEGER NOT NULL,
    col INTEGER NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    formula TEXT,
    PRIMARY KEY (tab_id, row, col)
  );
  CREATE TABLE IF NOT EXISTS column_formats (
    tab_id TEXT NOT NULL,
    col INTEGER NOT NULL,
    format TEXT NOT NULL,
    PRIMARY KEY (tab_id, col)
  );
  CREATE TABLE IF NOT EXISTS merges (
    tab_id TEXT NOT NULL,
    anchor_row INTEGER NOT NULL,
    anchor_col INTEGER NOT NULL,
    row_span INTEGER NOT NULL,
    col_span INTEGER NOT NULL,
    PRIMARY KEY (tab_id, anchor_row, anchor_col)
  );
`);

// column_formats에 width 컬럼을 나중에 추가했습니다. 이미 있으면 SQLite가 에러를 던지므로 무시합니다.
try {
  db.exec('ALTER TABLE column_formats ADD COLUMN width INTEGER');
} catch {
  // 이미 컬럼이 있는 경우
}

interface SheetRow {
  id: string;
  name: string;
  order_num: number;
}
interface TabRow {
  id: string;
  sheet_id: string;
  name: string;
  rows: number;
  cols: number;
}
interface CellRow {
  row: number;
  col: number;
  value: string;
  formula: string | null;
}

const toSheet = (row: SheetRow): Sheet => ({ id: row.id, name: row.name, order: row.order_num });
const toTab = (row: TabRow): Tab => ({
  id: row.id,
  sheetId: row.sheet_id,
  name: row.name,
  rows: row.rows,
  cols: row.cols,
});

export const store = {
  listSheets(): Sheet[] {
    const rows = db.prepare('SELECT id, name, order_num FROM sheets ORDER BY order_num ASC').all() as unknown as SheetRow[];
    return rows.map(toSheet);
  },

  createSheet(name: string): Sheet {
    const { c } = db.prepare('SELECT COUNT(*) as c FROM sheets').get() as unknown as { c: number };
    const id = randomUUID();
    db.prepare('INSERT INTO sheets (id, name, order_num) VALUES (?, ?, ?)').run(id, name, c);
    return { id, name, order: c };
  },

  renameSheet(sheetId: string, name: string): Sheet | undefined {
    const existing = db.prepare('SELECT id, name, order_num FROM sheets WHERE id = ?').get(sheetId) as unknown as
      | SheetRow
      | undefined;
    if (!existing) return undefined;
    db.prepare('UPDATE sheets SET name = ? WHERE id = ?').run(name, sheetId);
    return { ...toSheet(existing), name };
  },

  deleteSheet(sheetId: string) {
    store.listTabs(sheetId).forEach((t) => store.deleteTab(t.id));
    db.prepare('DELETE FROM sheets WHERE id = ?').run(sheetId);
  },

  listTabs(sheetId: string): Tab[] {
    const rows = db
      .prepare('SELECT id, sheet_id, name, rows, cols FROM tabs WHERE sheet_id = ?')
      .all(sheetId) as unknown as TabRow[];
    return rows.map(toTab);
  },

  createTab(sheetId: string, name: string, rows = 15, cols = 5): Tab {
    const id = randomUUID();
    db.prepare('INSERT INTO tabs (id, sheet_id, name, rows, cols) VALUES (?, ?, ?, ?, ?)').run(
      id,
      sheetId,
      name,
      rows,
      cols
    );
    return { id, sheetId, name, rows, cols };
  },

  getTab(tabId: string): Tab | undefined {
    const row = db
      .prepare('SELECT id, sheet_id, name, rows, cols FROM tabs WHERE id = ?')
      .get(tabId) as unknown as TabRow | undefined;
    return row ? toTab(row) : undefined;
  },

  // index번째 자리에 새 행을 끼워 넣습니다 (index === tab.rows면 맨 아래에 추가하는 것과 같음).
  // index 이상이던 셀/병합은 한 칸씩 아래로 밀리고, 병합 범위 "안"에 삽입되면 그 병합은 늘어납니다.
  // 수식이 참조하던 셀 주소도 같이 밀어줘서 기존 수식이 계속 같은 칸을 가리키게 합니다.
  insertRow(tabId: string, index: number): Tab | undefined {
    const tab = store.getTab(tabId);
    if (!tab) return undefined;

    db.exec('BEGIN');
    try {
      const shifted = db
        .prepare('SELECT row, col, value, formula FROM cells WHERE tab_id = ? AND row >= ?')
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND row >= ?').run(tabId, index);
      const insertCell = db.prepare('INSERT INTO cells (tab_id, row, col, value, formula) VALUES (?, ?, ?, ?, ?)');
      shifted.forEach((c) => insertCell.run(tabId, c.row + 1, c.col, c.value, c.formula));

      const formulaCells = db
        .prepare('SELECT row, col, formula FROM cells WHERE tab_id = ? AND formula IS NOT NULL')
        .all(tabId) as unknown as { row: number; col: number; formula: string }[];
      const updateFormula = db.prepare('UPDATE cells SET formula = ? WHERE tab_id = ? AND row = ? AND col = ?');
      formulaCells.forEach((c) => {
        const next = shiftFormulaRefs(c.formula, 'row', index);
        if (next !== c.formula) updateFormula.run(next, tabId, c.row, c.col);
      });

      const merges = store.getMerges(tabId);
      db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);
      const insertMerge = db.prepare(
        'INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)'
      );
      merges.forEach((m) => {
        let { anchorRow, rowSpan } = m;
        if (index <= anchorRow) anchorRow += 1;
        else if (index < anchorRow + rowSpan) rowSpan += 1;
        insertMerge.run(tabId, anchorRow, m.anchorCol, rowSpan, m.colSpan);
      });

      db.prepare('UPDATE tabs SET rows = rows + 1 WHERE id = ?').run(tabId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return store.getTab(tabId);
  },

  // index번째 자리에 새 열을 끼워 넣습니다. insertRow와 동일한 원리로 셀/열포맷/병합/수식을 모두 조정합니다.
  insertColumn(tabId: string, index: number): Tab | undefined {
    const tab = store.getTab(tabId);
    if (!tab) return undefined;

    db.exec('BEGIN');
    try {
      const shiftedCells = db
        .prepare('SELECT row, col, value, formula FROM cells WHERE tab_id = ? AND col >= ?')
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND col >= ?').run(tabId, index);
      const insertCell = db.prepare('INSERT INTO cells (tab_id, row, col, value, formula) VALUES (?, ?, ?, ?, ?)');
      shiftedCells.forEach((c) => insertCell.run(tabId, c.row, c.col + 1, c.value, c.formula));

      const formulaCells = db
        .prepare('SELECT row, col, formula FROM cells WHERE tab_id = ? AND formula IS NOT NULL')
        .all(tabId) as unknown as { row: number; col: number; formula: string }[];
      const updateFormula = db.prepare('UPDATE cells SET formula = ? WHERE tab_id = ? AND row = ? AND col = ?');
      formulaCells.forEach((c) => {
        const next = shiftFormulaRefs(c.formula, 'col', index);
        if (next !== c.formula) updateFormula.run(next, tabId, c.row, c.col);
      });

      const shiftedFormats = db
        .prepare('SELECT col, format, width FROM column_formats WHERE tab_id = ? AND col >= ?')
        .all(tabId, index) as unknown as { col: number; format: ColumnFormat; width: number | null }[];
      db.prepare('DELETE FROM column_formats WHERE tab_id = ? AND col >= ?').run(tabId, index);
      const insertFormat = db.prepare(
        'INSERT INTO column_formats (tab_id, col, format, width) VALUES (?, ?, ?, ?)'
      );
      shiftedFormats.forEach((f) => insertFormat.run(tabId, f.col + 1, f.format, f.width));

      const merges = store.getMerges(tabId);
      db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);
      const insertMerge = db.prepare(
        'INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)'
      );
      merges.forEach((m) => {
        let { anchorCol, colSpan } = m;
        if (index <= anchorCol) anchorCol += 1;
        else if (index < anchorCol + colSpan) colSpan += 1;
        insertMerge.run(tabId, m.anchorRow, anchorCol, m.rowSpan, colSpan);
      });

      db.prepare('UPDATE tabs SET cols = cols + 1 WHERE id = ?').run(tabId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return store.getTab(tabId);
  },

  renameTab(tabId: string, name: string): Tab | undefined {
    const existing = store.getTab(tabId);
    if (!existing) return undefined;
    db.prepare('UPDATE tabs SET name = ? WHERE id = ?').run(name, tabId);
    return { ...existing, name };
  },

  deleteTab(tabId: string) {
    db.prepare('DELETE FROM cells WHERE tab_id = ?').run(tabId);
    db.prepare('DELETE FROM column_formats WHERE tab_id = ?').run(tabId);
    db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);
    db.prepare('DELETE FROM tabs WHERE id = ?').run(tabId);
  },

  getCells(tabId: string): Record<string, CellData> {
    const rows = db
      .prepare('SELECT row, col, value, formula FROM cells WHERE tab_id = ?')
      .all(tabId) as unknown as CellRow[];
    const result: Record<string, CellData> = {};
    rows.forEach((r) => {
      result[`${r.row}_${r.col}`] = { value: r.value, formula: r.formula ?? undefined };
    });
    return result;
  },

  setCell(tabId: string, row: number, col: number, data: CellData) {
    db.prepare(
      `INSERT INTO cells (tab_id, row, col, value, formula) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tab_id, row, col) DO UPDATE SET value = excluded.value, formula = excluded.formula`
    ).run(tabId, row, col, data.value, data.formula ?? null);
  },

  getColumnFormats(tabId: string): Record<number, ColumnFormat> {
    const rows = db
      .prepare('SELECT col, format FROM column_formats WHERE tab_id = ?')
      .all(tabId) as unknown as { col: number; format: ColumnFormat }[];
    const result: Record<number, ColumnFormat> = {};
    rows.forEach((r) => {
      result[r.col] = r.format;
    });
    return result;
  },

  setColumnFormat(tabId: string, col: number, format: ColumnFormat) {
    db.prepare(
      `INSERT INTO column_formats (tab_id, col, format) VALUES (?, ?, ?)
       ON CONFLICT(tab_id, col) DO UPDATE SET format = excluded.format`
    ).run(tabId, col, format);
  },

  getColumnWidths(tabId: string): Record<number, number> {
    const rows = db
      .prepare('SELECT col, width FROM column_formats WHERE tab_id = ? AND width IS NOT NULL')
      .all(tabId) as unknown as { col: number; width: number }[];
    const result: Record<number, number> = {};
    rows.forEach((r) => {
      result[r.col] = r.width;
    });
    return result;
  },

  // width가 null이면 수동으로 지정한 너비를 지우고 다시 "내용에 맞춰 자동 계산"으로 되돌립니다.
  setColumnWidth(tabId: string, col: number, width: number | null) {
    if (width === null) {
      db.prepare('UPDATE column_formats SET width = NULL WHERE tab_id = ? AND col = ?').run(tabId, col);
      return;
    }
    db.prepare(
      `INSERT INTO column_formats (tab_id, col, format, width) VALUES (?, ?, 'text', ?)
       ON CONFLICT(tab_id, col) DO UPDATE SET width = excluded.width`
    ).run(tabId, col, width);
  },

  getMerges(tabId: string): Merge[] {
    const rows = db
      .prepare('SELECT anchor_row, anchor_col, row_span, col_span FROM merges WHERE tab_id = ?')
      .all(tabId) as unknown as { anchor_row: number; anchor_col: number; row_span: number; col_span: number }[];
    return rows.map((r) => ({
      anchorRow: r.anchor_row,
      anchorCol: r.anchor_col,
      rowSpan: r.row_span,
      colSpan: r.col_span,
    }));
  },

  setMerge(tabId: string, anchorRow: number, anchorCol: number, rowSpan: number, colSpan: number) {
    db.prepare(
      `INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tab_id, anchor_row, anchor_col) DO UPDATE SET row_span = excluded.row_span, col_span = excluded.col_span`
    ).run(tabId, anchorRow, anchorCol, rowSpan, colSpan);
  },

  deleteMerge(tabId: string, anchorRow: number, anchorCol: number) {
    db.prepare('DELETE FROM merges WHERE tab_id = ? AND anchor_row = ? AND anchor_col = ?').run(
      tabId,
      anchorRow,
      anchorCol
    );
  },
};
