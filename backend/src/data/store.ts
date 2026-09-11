import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import {
  Sheet,
  Tab,
  CellData,
  ColumnFormat,
  Merge,
  HistoryEntry,
  EventItem,
  EventLink,
  MemoSummary,
  Memo,
  MemoHistoryEntry,
  DeletedSheet,
  DeletedTab,
  DeletedMemo,
} from '../types';
import { shiftFormulaRefs } from '../formula/shiftRefs';

// 클라우드에 영구 디스크(volume)를 붙였다면 DB_PATH 환경변수로 그 경로를 가리키게 하세요.
// (예: Fly.io에서 볼륨을 /data에 마운트했다면 DB_PATH=/data/db.sqlite)
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'db.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// 둘이 동시에 읽고 쓸 때 쓰기가 읽기를 막지 않도록 WAL 모드로 켭니다.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
    cols INTEGER NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0
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

// cells에 "누가 언제 고쳤는지"를 나중에 추가했습니다. 동시 편집 충돌 감지에 씁니다.
if (!columnExists('cells', 'updated_at')) {
  db.exec('ALTER TABLE cells ADD COLUMN updated_at INTEGER');
}
if (!columnExists('cells', 'updated_by')) {
  db.exec('ALTER TABLE cells ADD COLUMN updated_by TEXT');
}

// 셀 값이 바뀔 때마다 한 줄씩 쌓는 변경 이력. 되돌리기·"누가 언제 뭘 바꿨나" 확인에 씁니다.
db.exec(`
  CREATE TABLE IF NOT EXISTS cell_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tab_id TEXT NOT NULL,
    row INTEGER NOT NULL,
    col INTEGER NOT NULL,
    prev_value TEXT NOT NULL DEFAULT '',
    prev_formula TEXT,
    next_value TEXT NOT NULL DEFAULT '',
    next_formula TEXT,
    editor TEXT,
    kind TEXT NOT NULL DEFAULT 'edit',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cell_history_tab ON cell_history (tab_id, id DESC);
`);

// 메인화면용 기념일/D-day 목록. date는 'YYYY-MM-DD' 문자열.
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    order_num INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    updated_by TEXT
  );
  CREATE TABLE IF NOT EXISTS event_links (
    event_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    PRIMARY KEY (event_id, kind, ref_id)
  );
  CREATE INDEX IF NOT EXISTS idx_event_links_event ON event_links (event_id);

  CREATE TABLE IF NOT EXISTS memo_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memo_id TEXT NOT NULL,
    prev_content TEXT NOT NULL DEFAULT '',
    next_content TEXT NOT NULL DEFAULT '',
    editor TEXT,
    kind TEXT NOT NULL DEFAULT 'edit',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memo_history_memo ON memo_history (memo_id, id DESC);
`);

// events에 pinned 컬럼을 나중에 추가했습니다. 고정(공지처럼 맨 위)된 일정을 표시합니다.
if (!columnExists('events', 'pinned')) {
  db.exec('ALTER TABLE events ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
}

// events에 시간·장소·메모를 나중에 추가했습니다. 모두 선택 입력이라 NULL 허용.
if (!columnExists('events', 'time')) db.exec('ALTER TABLE events ADD COLUMN time TEXT');
if (!columnExists('events', 'location')) db.exec('ALTER TABLE events ADD COLUMN location TEXT');
if (!columnExists('events', 'note')) db.exec('ALTER TABLE events ADD COLUMN note TEXT');

// events에 "누가 언제 고쳤는지"를 나중에 추가했습니다. 동시 편집 충돌 감지에 씁니다(셀/메모와 동일한 baseUpdatedAt 방식).
if (!columnExists('events', 'updated_at')) db.exec('ALTER TABLE events ADD COLUMN updated_at INTEGER');
if (!columnExists('events', 'updated_by')) db.exec('ALTER TABLE events ADD COLUMN updated_by TEXT');

// 삭제해도 바로 지우지 않고 "삭제된 시각"만 표시해두는 소프트 삭제용 컬럼.
// null이면 살아있는 항목, 값이 있으면 지워진 항목(목록에서 숨기되 복원 가능).
if (!columnExists('sheets', 'deleted_at')) db.exec('ALTER TABLE sheets ADD COLUMN deleted_at INTEGER');
if (!columnExists('sheets', 'deleted_by')) db.exec('ALTER TABLE sheets ADD COLUMN deleted_by TEXT');
if (!columnExists('tabs', 'deleted_at')) db.exec('ALTER TABLE tabs ADD COLUMN deleted_at INTEGER');
if (!columnExists('tabs', 'deleted_by')) db.exec('ALTER TABLE tabs ADD COLUMN deleted_by TEXT');
if (!columnExists('memos', 'deleted_at')) db.exec('ALTER TABLE memos ADD COLUMN deleted_at INTEGER');
if (!columnExists('memos', 'deleted_by')) db.exec('ALTER TABLE memos ADD COLUMN deleted_by TEXT');

// tabs에 order_num 컬럼을 나중에 추가했습니다. 기존 탭들은 sheet별로 rowid(생성 순서) 기준으로 순번을 매겨줍니다.
if (!columnExists('tabs', 'order_num')) {
  db.exec('ALTER TABLE tabs ADD COLUMN order_num INTEGER NOT NULL DEFAULT 0');
  const rows = db
    .prepare('SELECT rowid as rid, id, sheet_id FROM tabs ORDER BY sheet_id ASC, rid ASC')
    .all() as unknown as { rid: number; id: string; sheet_id: string }[];
  const counters: Record<string, number> = {};
  const updateOrder = db.prepare('UPDATE tabs SET order_num = ? WHERE id = ?');
  rows.forEach((r) => {
    const next = counters[r.sheet_id] ?? 0;
    updateOrder.run(next, r.id);
    counters[r.sheet_id] = next + 1;
  });
}

interface SheetRow {
  id: string;
  name: string;
  order_num: number;
  deleted_at?: number | null;
  deleted_by?: string | null;
}
interface TabRow {
  id: string;
  sheet_id: string;
  name: string;
  rows: number;
  cols: number;
  order_num: number;
  deleted_at?: number | null;
  deleted_by?: string | null;
}
interface CellRow {
  row: number;
  col: number;
  value: string;
  formula: string | null;
  updated_at: number | null;
  updated_by: string | null;
}

// 행/열 삽입·삭제로 셀을 지웠다가 다시 넣을 때 updated_at/updated_by까지 그대로 옮기기 위한 공통 컬럼 목록.
const CELL_COLS = 'row, col, value, formula, updated_at, updated_by';
const insertCellSql =
  'INSERT INTO cells (tab_id, row, col, value, formula, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)';
function reinsertCell(tabId: string, c: CellRow, rowDelta: number, colDelta: number) {
  return [tabId, c.row + rowDelta, c.col + colDelta, c.value, c.formula, c.updated_at, c.updated_by] as const;
}

interface HistoryRow {
  id: number;
  tab_id: string;
  row: number;
  col: number;
  prev_value: string;
  prev_formula: string | null;
  next_value: string;
  next_formula: string | null;
  editor: string | null;
  kind: string;
  created_at: number;
}

const toHistory = (r: HistoryRow): HistoryEntry => ({
  id: r.id,
  tabId: r.tab_id,
  row: r.row,
  col: r.col,
  prevValue: r.prev_value,
  prevFormula: r.prev_formula ?? undefined,
  nextValue: r.next_value,
  nextFormula: r.next_formula ?? undefined,
  editor: r.editor ?? undefined,
  kind: r.kind === 'revert' ? 'revert' : 'edit',
  createdAt: r.created_at,
});

interface EventRow {
  id: string;
  title: string;
  date: string;
  order_num: number;
  pinned: number;
  time: string | null;
  location: string | null;
  note: string | null;
  updated_at: number | null;
  updated_by: string | null;
}

const toEvent = (r: EventRow, links: EventLink[]): EventItem => ({
  id: r.id,
  title: r.title,
  date: r.date,
  order: r.order_num,
  pinned: !!r.pinned,
  time: r.time ?? undefined,
  location: r.location ?? undefined,
  note: r.note ?? undefined,
  updatedAt: r.updated_at ?? undefined,
  updatedBy: r.updated_by ?? undefined,
  links,
});

interface MemoHistoryRow {
  id: number;
  prev_content: string;
  next_content: string;
  editor: string | null;
  kind: string;
  created_at: number;
}

const toMemoHistory = (r: MemoHistoryRow): MemoHistoryEntry => ({
  id: r.id,
  content: r.next_content,
  prevContent: r.prev_content,
  editor: r.editor ?? undefined,
  kind: r.kind === 'revert' ? 'revert' : 'edit',
  createdAt: r.created_at,
});

const toSheet = (row: SheetRow): Sheet => ({ id: row.id, name: row.name, order: row.order_num });
const toTab = (row: TabRow): Tab => ({
  id: row.id,
  sheetId: row.sheet_id,
  name: row.name,
  rows: row.rows,
  cols: row.cols,
  order: row.order_num,
});

// 행/열 삭제 직전의 탭 상태를 한 번만 기억해뒀다가 "실행취소"로 되돌릴 수 있게 합니다.
// 서버 메모리에만 있어서 재시작하면 사라지고, 탭당 가장 최근 삭제 1건만 보관합니다.
interface TabSnapshot {
  rows: number;
  cols: number;
  cells: CellRow[];
  columnFormats: { col: number; format: ColumnFormat; width: number | null }[];
  merges: { anchor_row: number; anchor_col: number; row_span: number; col_span: number }[];
}
const lastDeleteSnapshots = new Map<string, TabSnapshot>();

function snapshotTab(tabId: string, tab: Tab): TabSnapshot {
  const cells = db.prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ?`).all(tabId) as unknown as CellRow[];
  const columnFormats = db
    .prepare('SELECT col, format, width FROM column_formats WHERE tab_id = ?')
    .all(tabId) as unknown as { col: number; format: ColumnFormat; width: number | null }[];
  const merges = db
    .prepare('SELECT anchor_row, anchor_col, row_span, col_span FROM merges WHERE tab_id = ?')
    .all(tabId) as unknown as { anchor_row: number; anchor_col: number; row_span: number; col_span: number }[];
  return { rows: tab.rows, cols: tab.cols, cells, columnFormats, merges };
}

export const store = {
  listSheets(): Sheet[] {
    const rows = db
      .prepare('SELECT id, name, order_num FROM sheets WHERE deleted_at IS NULL ORDER BY order_num ASC')
      .all() as unknown as SheetRow[];
    return rows.map(toSheet);
  },

  // 삭제된 시트 목록(최근 삭제 순). 복원 화면(휴지통)에 씁니다.
  listDeletedSheets(): DeletedSheet[] {
    const rows = db
      .prepare(
        'SELECT id, name, order_num, deleted_at, deleted_by FROM sheets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
      )
      .all() as unknown as Required<SheetRow>[];
    return rows.map((r) => ({ ...toSheet(r), deletedAt: r.deleted_at as number, deletedBy: r.deleted_by ?? undefined }));
  },

  createSheet(name: string): Sheet {
    // COUNT(*)로 순번을 매기면 삭제 후 다시 만들 때 다른 항목과 순번이 겹칠 수 있어 MAX+1을 씁니다.
    const { m } = db.prepare('SELECT COALESCE(MAX(order_num), -1) as m FROM sheets').get() as unknown as {
      m: number;
    };
    const order = m + 1;
    const id = randomUUID();
    db.prepare('INSERT INTO sheets (id, name, order_num) VALUES (?, ?, ?)').run(id, name, order);
    return { id, name, order };
  },

  reorderSheets(orderedIds: string[]) {
    const update = db.prepare('UPDATE sheets SET order_num = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
      orderedIds.forEach((id, i) => update.run(i, id));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  renameSheet(sheetId: string, name: string): Sheet | undefined {
    const existing = db.prepare('SELECT id, name, order_num FROM sheets WHERE id = ?').get(sheetId) as unknown as
      | SheetRow
      | undefined;
    if (!existing) return undefined;
    db.prepare('UPDATE sheets SET name = ? WHERE id = ?').run(name, sheetId);
    return { ...toSheet(existing), name };
  },

  // 완전히 지우지 않고 삭제 시각만 표시해서 숨깁니다. 안의 탭들도 같은 시각으로 같이 숨기고,
  // restoreSheet에서 그 시각이 같은 탭들만 골라 같이 되살립니다(시트 삭제보다 먼저 개별 삭제된 탭은 그대로 둠).
  deleteSheet(sheetId: string, editor: string | undefined) {
    const now = Date.now();
    store.listTabs(sheetId).forEach((t) => store.deleteTab(t.id, editor, now));
    db.prepare('UPDATE sheets SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(now, editor ?? null, sheetId);
  },

  restoreSheet(sheetId: string): Sheet | undefined {
    const row = db.prepare('SELECT id, name, order_num, deleted_at FROM sheets WHERE id = ?').get(sheetId) as
      | unknown as (SheetRow & { deleted_at: number | null })
      | undefined;
    if (!row || row.deleted_at == null) return undefined;
    db.prepare('UPDATE tabs SET deleted_at = NULL, deleted_by = NULL WHERE sheet_id = ? AND deleted_at = ?').run(
      sheetId,
      row.deleted_at
    );
    db.prepare('UPDATE sheets SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(sheetId);
    return toSheet(row);
  },

  listTabs(sheetId: string): Tab[] {
    const rows = db
      .prepare(
        'SELECT id, sheet_id, name, rows, cols, order_num FROM tabs WHERE sheet_id = ? AND deleted_at IS NULL ORDER BY order_num ASC'
      )
      .all(sheetId) as unknown as TabRow[];
    return rows.map(toTab);
  },

  // 삭제된 탭 목록(이 시트 안에서 개별 삭제된 것들, 시트 전체 삭제로 같이 숨겨진 건 시트가 복원돼야 보임).
  listDeletedTabs(sheetId: string): DeletedTab[] {
    const rows = db
      .prepare(
        `SELECT id, sheet_id, name, rows, cols, order_num, deleted_at, deleted_by
         FROM tabs WHERE sheet_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`
      )
      .all(sheetId) as unknown as Required<TabRow>[];
    return rows.map((r) => ({ ...toTab(r), deletedAt: r.deleted_at as number, deletedBy: r.deleted_by ?? undefined }));
  },

  createTab(sheetId: string, name: string, rows = 15, cols = 5): Tab {
    // COUNT(*)로 순번을 매기면 삭제 후 다시 만들 때 다른 탭과 순번이 겹칠 수 있어 MAX+1을 씁니다.
    const { m } = db.prepare('SELECT COALESCE(MAX(order_num), -1) as m FROM tabs WHERE sheet_id = ?').get(
      sheetId
    ) as unknown as { m: number };
    const order = m + 1;
    const id = randomUUID();
    db.prepare('INSERT INTO tabs (id, sheet_id, name, rows, cols, order_num) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      sheetId,
      name,
      rows,
      cols,
      order
    );
    return { id, sheetId, name, rows, cols, order };
  },

  reorderTabs(sheetId: string, orderedIds: string[]) {
    const update = db.prepare('UPDATE tabs SET order_num = ? WHERE id = ? AND sheet_id = ?');
    db.exec('BEGIN');
    try {
      orderedIds.forEach((id, i) => update.run(i, id, sheetId));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  getTab(tabId: string): Tab | undefined {
    const row = db
      .prepare('SELECT id, sheet_id, name, rows, cols, order_num FROM tabs WHERE id = ? AND deleted_at IS NULL')
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
        .prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ? AND row >= ?`)
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND row >= ?').run(tabId, index);
      const insertCell = db.prepare(insertCellSql);
      shifted.forEach((c) => insertCell.run(...reinsertCell(tabId, c, 1, 0)));

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
        .prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ? AND col >= ?`)
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND col >= ?').run(tabId, index);
      const insertCell = db.prepare(insertCellSql);
      shiftedCells.forEach((c) => insertCell.run(...reinsertCell(tabId, c, 0, 1)));

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

  // index번째 행을 지웁니다. insertRow의 반대 방향으로 셀/병합/수식을 조정합니다.
  // 지워지는 행을 정확히 가리키던 수식은 되돌릴 방법이 없어서, 그 자리로 새로 밀려온 행을 가리키게 둡니다.
  deleteRow(tabId: string, index: number): Tab | undefined {
    const tab = store.getTab(tabId);
    if (!tab) return undefined;

    lastDeleteSnapshots.set(tabId, snapshotTab(tabId, tab));

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND row = ?').run(tabId, index);

      const shifted = db
        .prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ? AND row > ?`)
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND row > ?').run(tabId, index);
      const insertCell = db.prepare(insertCellSql);
      shifted.forEach((c) => insertCell.run(...reinsertCell(tabId, c, -1, 0)));

      const formulaCells = db
        .prepare('SELECT row, col, formula FROM cells WHERE tab_id = ? AND formula IS NOT NULL')
        .all(tabId) as unknown as { row: number; col: number; formula: string }[];
      const updateFormula = db.prepare('UPDATE cells SET formula = ? WHERE tab_id = ? AND row = ? AND col = ?');
      formulaCells.forEach((c) => {
        const next = shiftFormulaRefs(c.formula, 'row', index, 'delete');
        if (next !== c.formula) updateFormula.run(next, tabId, c.row, c.col);
      });

      const merges = store.getMerges(tabId);
      db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);
      const insertMerge = db.prepare(
        'INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)'
      );
      merges.forEach((m) => {
        let { anchorRow, rowSpan } = m;
        if (index < anchorRow) anchorRow -= 1;
        else if (index < anchorRow + rowSpan) rowSpan -= 1;
        if (rowSpan >= 1) insertMerge.run(tabId, anchorRow, m.anchorCol, rowSpan, m.colSpan);
      });

      db.prepare('UPDATE tabs SET rows = rows - 1 WHERE id = ?').run(tabId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return store.getTab(tabId);
  },

  // index번째 열을 지웁니다. insertColumn의 반대 방향으로 셀/열포맷/병합/수식을 조정합니다.
  deleteColumn(tabId: string, index: number): Tab | undefined {
    const tab = store.getTab(tabId);
    if (!tab) return undefined;

    lastDeleteSnapshots.set(tabId, snapshotTab(tabId, tab));

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND col = ?').run(tabId, index);

      const shiftedCells = db
        .prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ? AND col > ?`)
        .all(tabId, index) as unknown as CellRow[];
      db.prepare('DELETE FROM cells WHERE tab_id = ? AND col > ?').run(tabId, index);
      const insertCell = db.prepare(insertCellSql);
      shiftedCells.forEach((c) => insertCell.run(...reinsertCell(tabId, c, 0, -1)));

      const formulaCells = db
        .prepare('SELECT row, col, formula FROM cells WHERE tab_id = ? AND formula IS NOT NULL')
        .all(tabId) as unknown as { row: number; col: number; formula: string }[];
      const updateFormula = db.prepare('UPDATE cells SET formula = ? WHERE tab_id = ? AND row = ? AND col = ?');
      formulaCells.forEach((c) => {
        const next = shiftFormulaRefs(c.formula, 'col', index, 'delete');
        if (next !== c.formula) updateFormula.run(next, tabId, c.row, c.col);
      });

      db.prepare('DELETE FROM column_formats WHERE tab_id = ? AND col = ?').run(tabId, index);
      const shiftedFormats = db
        .prepare('SELECT col, format, width FROM column_formats WHERE tab_id = ? AND col > ?')
        .all(tabId, index) as unknown as { col: number; format: ColumnFormat; width: number | null }[];
      db.prepare('DELETE FROM column_formats WHERE tab_id = ? AND col > ?').run(tabId, index);
      const insertFormat = db.prepare(
        'INSERT INTO column_formats (tab_id, col, format, width) VALUES (?, ?, ?, ?)'
      );
      shiftedFormats.forEach((f) => insertFormat.run(tabId, f.col - 1, f.format, f.width));

      const merges = store.getMerges(tabId);
      db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);
      const insertMerge = db.prepare(
        'INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)'
      );
      merges.forEach((m) => {
        let { anchorCol, colSpan } = m;
        if (index < anchorCol) anchorCol -= 1;
        else if (index < anchorCol + colSpan) colSpan -= 1;
        if (colSpan >= 1) insertMerge.run(tabId, m.anchorRow, anchorCol, m.rowSpan, colSpan);
      });

      db.prepare('UPDATE tabs SET cols = cols - 1 WHERE id = ?').run(tabId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return store.getTab(tabId);
  },

  // deleteRow/deleteColumn 직전 상태로 되돌립니다. 한 번 쓰면 사라지고, 그 뒤에 다른 편집을 했더라도
  // 전부 삭제 시점 상태로 덮어써버리니 사용 범위는 "방금 지운 행/열 되돌리기" 정도로 좁게 씁니다.
  undoLastDelete(tabId: string): Tab | undefined {
    const snapshot = lastDeleteSnapshots.get(tabId);
    if (!snapshot) return undefined;
    lastDeleteSnapshots.delete(tabId);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM cells WHERE tab_id = ?').run(tabId);
      db.prepare('DELETE FROM column_formats WHERE tab_id = ?').run(tabId);
      db.prepare('DELETE FROM merges WHERE tab_id = ?').run(tabId);

      const insertCell = db.prepare(insertCellSql);
      snapshot.cells.forEach((c) => insertCell.run(...reinsertCell(tabId, c, 0, 0)));

      const insertFormat = db.prepare(
        'INSERT INTO column_formats (tab_id, col, format, width) VALUES (?, ?, ?, ?)'
      );
      snapshot.columnFormats.forEach((f) => insertFormat.run(tabId, f.col, f.format, f.width));

      const insertMerge = db.prepare(
        'INSERT INTO merges (tab_id, anchor_row, anchor_col, row_span, col_span) VALUES (?, ?, ?, ?, ?)'
      );
      snapshot.merges.forEach((m) =>
        insertMerge.run(tabId, m.anchor_row, m.anchor_col, m.row_span, m.col_span)
      );

      db.prepare('UPDATE tabs SET rows = ?, cols = ? WHERE id = ?').run(snapshot.rows, snapshot.cols, tabId);
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

  // 완전히 지우지 않고 삭제 시각만 표시해서 숨깁니다. 셀·이력은 그대로 남겨둬서 나중에 복원하면 그대로 돌아옵니다.
  // deletedAt을 넘기면(시트 전체 삭제로 같이 지워지는 경우) 그 시각을 쓰고, 아니면 지금 시각을 씁니다.
  deleteTab(tabId: string, editor: string | undefined, deletedAt?: number) {
    const now = deletedAt ?? Date.now();
    db.prepare('UPDATE tabs SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(now, editor ?? null, tabId);
    lastDeleteSnapshots.delete(tabId);
  },

  restoreTab(tabId: string): Tab | undefined {
    db.prepare('UPDATE tabs SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(tabId);
    return store.getTab(tabId);
  },

  getCells(tabId: string): Record<string, CellData> {
    const rows = db
      .prepare(`SELECT ${CELL_COLS} FROM cells WHERE tab_id = ?`)
      .all(tabId) as unknown as CellRow[];
    const result: Record<string, CellData> = {};
    rows.forEach((r) => {
      result[`${r.row}_${r.col}`] = {
        value: r.value,
        formula: r.formula ?? undefined,
        updatedAt: r.updated_at ?? undefined,
        updatedBy: r.updated_by ?? undefined,
      };
    });
    return result;
  },

  // 그 셀이 마지막으로 수정된 시각(ms). 한 번도 안 쓴 셀이면 null.
  getCellMeta(tabId: string, row: number, col: number): number | null {
    const r = db
      .prepare('SELECT value, formula, updated_at FROM cells WHERE tab_id = ? AND row = ? AND col = ?')
      .get(tabId, row, col) as unknown as { value: string; formula: string | null; updated_at: number | null } | undefined;
    return r?.updated_at ?? null;
  },

  // 셀 값을 바꾸면서 변경 이력을 한 줄 남깁니다. 실제로 바뀐 게 없으면 아무것도 안 하고 기존 시각을 돌려줍니다.
  // 반환값은 이 셀의 새 updated_at(ms) — 클라이언트가 다음 저장 때 충돌 감지 기준으로 다시 보냅니다.
  recordAndSetCell(
    tabId: string,
    row: number,
    col: number,
    data: CellData,
    editor: string | undefined,
    kind: 'edit' | 'revert' = 'edit'
  ): number {
    const existing = db
      .prepare('SELECT value, formula, updated_at FROM cells WHERE tab_id = ? AND row = ? AND col = ?')
      .get(tabId, row, col) as unknown as { value: string; formula: string | null; updated_at: number | null } | undefined;

    const nextFormula = data.formula ?? null;
    if (existing && existing.value === data.value && (existing.formula ?? null) === nextFormula) {
      return existing.updated_at ?? 0;
    }

    const now = Date.now();
    db.exec('BEGIN');
    try {
      db.prepare(
        `INSERT INTO cells (tab_id, row, col, value, formula, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tab_id, row, col) DO UPDATE SET value = excluded.value, formula = excluded.formula,
           updated_at = excluded.updated_at, updated_by = excluded.updated_by`
      ).run(tabId, row, col, data.value, nextFormula, now, editor ?? null);

      db.prepare(
        `INSERT INTO cell_history (tab_id, row, col, prev_value, prev_formula, next_value, next_formula, editor, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tabId,
        row,
        col,
        existing?.value ?? '',
        existing?.formula ?? null,
        data.value,
        nextFormula,
        editor ?? null,
        kind,
        now
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return now;
  },

  listHistory(tabId: string, limit = 30): HistoryEntry[] {
    const rows = db
      .prepare(
        `SELECT id, tab_id, row, col, prev_value, prev_formula, next_value, next_formula, editor, kind, created_at
         FROM cell_history WHERE tab_id = ? ORDER BY id DESC LIMIT ?`
      )
      .all(tabId, limit) as unknown as HistoryRow[];
    return rows.map(toHistory);
  },

  // 이력 한 건을 그 이전 값으로 되돌립니다. 그 사이 다른 수정이 있었으면(= 최신 이력이 아니면) 거절합니다.
  revertCell(
    tabId: string,
    historyId: number,
    editor: string | undefined
  ): { ok: true; row: number; col: number; updatedAt: number } | { ok: false; reason: 'not_found' | 'stale' } {
    const entry = db
      .prepare('SELECT id, row, col, prev_value, prev_formula, created_at FROM cell_history WHERE id = ? AND tab_id = ?')
      .get(historyId, tabId) as unknown as
      | { id: number; row: number; col: number; prev_value: string; prev_formula: string | null; created_at: number }
      | undefined;
    if (!entry) return { ok: false, reason: 'not_found' };

    if (store.getCellMeta(tabId, entry.row, entry.col) !== entry.created_at) {
      return { ok: false, reason: 'stale' };
    }

    const updatedAt = store.recordAndSetCell(
      tabId,
      entry.row,
      entry.col,
      { value: entry.prev_value, formula: entry.prev_formula ?? undefined },
      editor,
      'revert'
    );
    return { ok: true, row: entry.row, col: entry.col, updatedAt };
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

  // ── 메인화면: 기념일 / D-day ──────────────────────────────
  listEvents(): EventItem[] {
    const rows = db
      .prepare(
        `SELECT id, title, date, order_num, pinned, time, location, note, updated_at, updated_by
         FROM events ORDER BY pinned DESC, date ASC, time ASC, order_num ASC`
      )
      .all() as unknown as EventRow[];
    const linkRows = db
      .prepare('SELECT event_id, kind, ref_id FROM event_links')
      .all() as unknown as { event_id: string; kind: string; ref_id: string }[];
    const byEvent = new Map<string, EventLink[]>();
    linkRows.forEach((r) => {
      if (r.kind !== 'memo' && r.kind !== 'sheet') return;
      const list = byEvent.get(r.event_id) ?? [];
      list.push({ kind: r.kind, refId: r.ref_id });
      byEvent.set(r.event_id, list);
    });
    return rows.map((r) => toEvent(r, byEvent.get(r.id) ?? []));
  },

  getEvent(id: string): EventItem | undefined {
    return store.listEvents().find((e) => e.id === id);
  },

  // 그 일정이 마지막으로 수정된 시각(ms). 동시 편집 충돌 감지에 씁니다. 한 번도 안 고쳤으면 null.
  getEventMeta(id: string): number | null {
    const r = db.prepare('SELECT updated_at FROM events WHERE id = ?').get(id) as unknown as
      | { updated_at: number | null }
      | undefined;
    return r?.updated_at ?? null;
  },

  createEvent(input: {
    title: string;
    date: string;
    pinned?: boolean;
    time?: string | null;
    location?: string | null;
    note?: string | null;
  }, editor: string | undefined): EventItem {
    // COUNT(*)로 순번을 매기면 삭제 후 다시 만들 때 다른 일정과 순번이 겹칠 수 있어 MAX+1을 씁니다.
    const { m } = db.prepare('SELECT COALESCE(MAX(order_num), -1) as m FROM events').get() as unknown as {
      m: number;
    };
    const c = m + 1;
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO events (id, title, date, order_num, pinned, time, location, note, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.title,
      input.date,
      c,
      input.pinned ? 1 : 0,
      input.time || null,
      input.location || null,
      input.note || null,
      now,
      editor ?? null
    );
    return store.getEvent(id)!;
  },

  updateEvent(
    id: string,
    patch: {
      title?: string;
      date?: string;
      pinned?: boolean;
      // undefined = 그대로 두기, null 또는 '' = 지우기
      time?: string | null;
      location?: string | null;
      note?: string | null;
    },
    editor: string | undefined
  ): EventItem | undefined {
    const existing = db
      .prepare(
        'SELECT id, title, date, order_num, pinned, time, location, note, updated_at, updated_by FROM events WHERE id = ?'
      )
      .get(id) as unknown as EventRow | undefined;
    if (!existing) return undefined;
    const title = patch.title ?? existing.title;
    const date = patch.date ?? existing.date;
    const pinned = patch.pinned ?? !!existing.pinned;
    const time = patch.time !== undefined ? patch.time || null : existing.time;
    const location = patch.location !== undefined ? patch.location || null : existing.location;
    const note = patch.note !== undefined ? patch.note || null : existing.note;
    db.prepare(
      'UPDATE events SET title = ?, date = ?, pinned = ?, time = ?, location = ?, note = ?, updated_at = ?, updated_by = ? WHERE id = ?'
    ).run(title, date, pinned ? 1 : 0, time, location, note, Date.now(), editor ?? null, id);
    return store.getEvent(id)!;
  },

  deleteEvent(id: string) {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    db.prepare('DELETE FROM event_links WHERE event_id = ?').run(id);
  },

  getEventLinks(eventId: string): EventLink[] {
    const rows = db
      .prepare('SELECT kind, ref_id FROM event_links WHERE event_id = ?')
      .all(eventId) as unknown as { kind: string; ref_id: string }[];
    return rows
      .filter((r) => r.kind === 'memo' || r.kind === 'sheet')
      .map((r) => ({ kind: r.kind as 'memo' | 'sheet', refId: r.ref_id }));
  },

  // 기념일에 연결된 메모/시트 목록을 통째로 교체합니다.
  setEventLinks(eventId: string, links: EventLink[]) {
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM event_links WHERE event_id = ?').run(eventId);
      const ins = db.prepare('INSERT OR IGNORE INTO event_links (event_id, kind, ref_id) VALUES (?, ?, ?)');
      links.forEach((l) => ins.run(eventId, l.kind, l.refId));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  // ── 공유 메모장 ─────────────────────────────────────────
  listMemos(): MemoSummary[] {
    const rows = db
      .prepare(
        'SELECT id, title, order_num, updated_at, updated_by FROM memos WHERE deleted_at IS NULL ORDER BY order_num ASC'
      )
      .all() as unknown as {
      id: string;
      title: string;
      order_num: number;
      updated_at: number | null;
      updated_by: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      order: r.order_num,
      updatedAt: r.updated_at ?? undefined,
      updatedBy: r.updated_by ?? undefined,
    }));
  },

  // 삭제된 메모 목록(최근 삭제 순). 복원 화면(휴지통)에 씁니다.
  listDeletedMemos(): DeletedMemo[] {
    const rows = db
      .prepare(
        'SELECT id, title, deleted_at, deleted_by FROM memos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
      )
      .all() as unknown as { id: string; title: string; deleted_at: number; deleted_by: string | null }[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by ?? undefined,
    }));
  },

  getMemo(id: string): Memo | undefined {
    const r = db
      .prepare(
        'SELECT id, title, content, order_num, created_at, updated_at, updated_by FROM memos WHERE id = ? AND deleted_at IS NULL'
      )
      .get(id) as unknown as
      | {
          id: string;
          title: string;
          content: string;
          order_num: number;
          created_at: number;
          updated_at: number | null;
          updated_by: string | null;
        }
      | undefined;
    if (!r) return undefined;
    return {
      id: r.id,
      title: r.title,
      content: r.content,
      order: r.order_num,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined,
      updatedBy: r.updated_by ?? undefined,
    };
  },

  reorderMemos(orderedIds: string[]) {
    const update = db.prepare('UPDATE memos SET order_num = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
      orderedIds.forEach((id, i) => update.run(i, id));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  createMemo(title: string): Memo {
    // COUNT(*)로 순번을 매기면 삭제 후 다시 만들 때 다른 메모와 순번이 겹칠 수 있어 MAX+1을 씁니다.
    const { m } = db.prepare('SELECT COALESCE(MAX(order_num), -1) as m FROM memos').get() as unknown as {
      m: number;
    };
    const order = m + 1;
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO memos (id, title, content, order_num, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, title, '', order, now, now);
    return { id, title, content: '', order, createdAt: now, updatedAt: now };
  },

  // 반환값의 updatedAt은 새 수정 시각. 클라이언트가 다음 저장 때 충돌 감지 기준으로 다시 보냅니다.
  // 본문이 바뀌면 memo_history에 스냅샷 1건을 같이 남깁니다(되돌리기용).
  updateMemo(
    id: string,
    patch: { title?: string; content?: string },
    editor: string | undefined,
    kind: 'edit' | 'revert' = 'edit'
  ): Memo | undefined {
    const existing = store.getMemo(id);
    if (!existing) return undefined;
    const title = patch.title ?? existing.title;
    const content = patch.content ?? existing.content;
    if (title === existing.title && content === existing.content) return existing;
    const now = Date.now();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE memos SET title = ?, content = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(
        title,
        content,
        now,
        editor ?? null,
        id
      );
      if (content !== existing.content) {
        db.prepare(
          `INSERT INTO memo_history (memo_id, prev_content, next_content, editor, kind, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, existing.content, content, editor ?? null, kind, now);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { ...existing, title, content, updatedAt: now, updatedBy: editor };
  },

  listMemoHistory(memoId: string, limit = 50): MemoHistoryEntry[] {
    const rows = db
      .prepare(
        `SELECT id, prev_content, next_content, editor, kind, created_at
         FROM memo_history WHERE memo_id = ? ORDER BY id DESC LIMIT ?`
      )
      .all(memoId, limit) as unknown as MemoHistoryRow[];
    return rows.map(toMemoHistory);
  },

  // 이력 한 건의 스냅샷(next_content)으로 본문을 되돌립니다. 되돌리기 자체도 새 이력으로 남습니다.
  revertMemo(
    memoId: string,
    historyId: number,
    editor: string | undefined
  ): { ok: true; memo: Memo } | { ok: false; reason: 'not_found' } {
    const entry = db
      .prepare('SELECT next_content FROM memo_history WHERE id = ? AND memo_id = ?')
      .get(historyId, memoId) as unknown as { next_content: string } | undefined;
    if (!entry) return { ok: false, reason: 'not_found' };
    const memo = store.updateMemo(memoId, { content: entry.next_content }, editor, 'revert');
    if (!memo) return { ok: false, reason: 'not_found' };
    return { ok: true, memo };
  },

  getMemoMeta(id: string): number | null {
    const r = db.prepare('SELECT updated_at FROM memos WHERE id = ? AND deleted_at IS NULL').get(id) as unknown as
      | { updated_at: number | null }
      | undefined;
    return r?.updated_at ?? null;
  },

  // 완전히 지우지 않고 삭제 시각만 표시해서 숨깁니다. 본문·이력은 그대로 남겨둬서 복원하면 그대로 돌아옵니다.
  deleteMemo(id: string, editor: string | undefined) {
    db.prepare('UPDATE memos SET deleted_at = ?, deleted_by = ? WHERE id = ?').run(Date.now(), editor ?? null, id);
  },

  restoreMemo(id: string): Memo | undefined {
    db.prepare('UPDATE memos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?').run(id);
    return store.getMemo(id);
  },
};
