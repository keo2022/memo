import express from 'express';
import cors from 'cors';
import { store } from './data/store';
import { evaluateFormula } from './formula/evaluate';
import { CellData, ColumnFormat, Merge } from './types';

const COLUMN_FORMATS: ColumnFormat[] = ['text', 'checkbox', 'number'];

function mergesOverlap(a: Merge, b: Merge): boolean {
  return (
    a.anchorRow < b.anchorRow + b.rowSpan &&
    a.anchorRow + a.rowSpan > b.anchorRow &&
    a.anchorCol < b.anchorCol + b.colSpan &&
    a.anchorCol + a.colSpan > b.anchorCol
  );
}

const app = express();
app.use(cors());
app.use(express.json());

// 로그인은 없지만, 각 기기가 보낸 X-Editor 헤더로 "누가 고쳤는지"만 기록합니다.
// HTTP 헤더는 ASCII만 안전해서 클라이언트가 encodeURIComponent로 인코딩해 보냅니다.
app.use((req, _res, next) => {
  const raw = req.header('X-Editor');
  let decoded = '';
  if (raw) {
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
  }
  const trimmed = decoded.trim().slice(0, 40);
  (req as express.Request & { editor?: string }).editor = trimmed || undefined;
  next();
});

function getEditor(req: express.Request): string | undefined {
  return (req as express.Request & { editor?: string }).editor;
}

// stack: 지금 계산 중인 셀들. 순환 참조(A1=B1, B1=A1)면 무한 재귀로 서버가 죽으므로 0으로 끊습니다.
function computeCell(
  tabId: string,
  row: number,
  col: number,
  cache: Map<string, number>,
  stack: Set<string> = new Set()
): number {
  const key = `${row}_${col}`;
  if (cache.has(key)) return cache.get(key)!;
  if (stack.has(key)) return 0;

  const cells = store.getCells(tabId);
  const cell = cells[key];
  if (!cell) return 0;

  if (cell.formula) {
    stack.add(key);
    const value = evaluateFormula(cell.formula, (r, c) => computeCell(tabId, r, c, cache, stack));
    stack.delete(key);
    cache.set(key, value);
    return value;
  }

  const num = Number(cell.value);
  const value = cell.value !== '' && !isNaN(num) ? num : 0;
  cache.set(key, value);
  return value;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/sheets', (_req, res) => {
  res.json(store.listSheets());
});

app.post('/api/sheets', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createSheet(name));
});

// :sheetId 라우트보다 먼저 등록해야 "reorder"가 sheetId로 매칭되지 않습니다.
app.put('/api/sheets/reorder', (req, res) => {
  const { orderedIds } = req.body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds is required' });
  }
  store.reorderSheets(orderedIds);
  res.json(store.listSheets());
});

app.put('/api/sheets/:sheetId', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const sheet = store.renameSheet(req.params.sheetId, name.trim());
  if (!sheet) return res.status(404).json({ error: 'sheet not found' });
  res.json(sheet);
});

app.delete('/api/sheets/:sheetId', (req, res) => {
  store.deleteSheet(req.params.sheetId);
  res.status(204).end();
});

app.get('/api/sheets/:sheetId/tabs', (req, res) => {
  res.json(store.listTabs(req.params.sheetId));
});

app.post('/api/sheets/:sheetId/tabs', (req, res) => {
  const { name, rows, cols } = req.body as { name?: string; rows?: number; cols?: number };
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createTab(req.params.sheetId, name, rows, cols));
});

app.put('/api/sheets/:sheetId/tabs/reorder', (req, res) => {
  const { orderedIds } = req.body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds is required' });
  }
  store.reorderTabs(req.params.sheetId, orderedIds);
  res.json(store.listTabs(req.params.sheetId));
});

app.post('/api/tabs/:tabId/rows', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const { index } = req.body as { index?: number };
  if (!Number.isInteger(index) || index === undefined || index < 0 || index > tab.rows) {
    return res.status(400).json({ error: `index must be between 0 and ${tab.rows}` });
  }

  res.json(store.insertRow(tab.id, index));
});

app.post('/api/tabs/:tabId/columns', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const { index } = req.body as { index?: number };
  if (!Number.isInteger(index) || index === undefined || index < 0 || index > tab.cols) {
    return res.status(400).json({ error: `index must be between 0 and ${tab.cols}` });
  }

  res.json(store.insertColumn(tab.id, index));
});

app.delete('/api/tabs/:tabId/rows/:index', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= tab.rows) {
    return res.status(400).json({ error: `index must be between 0 and ${tab.rows - 1}` });
  }
  if (tab.rows <= 1) {
    return res.status(400).json({ error: 'must keep at least 1 row' });
  }

  res.json(store.deleteRow(tab.id, index));
});

app.delete('/api/tabs/:tabId/columns/:index', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= tab.cols) {
    return res.status(400).json({ error: `index must be between 0 and ${tab.cols - 1}` });
  }
  if (tab.cols <= 1) {
    return res.status(400).json({ error: 'must keep at least 1 column' });
  }

  res.json(store.deleteColumn(tab.id, index));
});

app.post('/api/tabs/:tabId/undo-delete', (req, res) => {
  const tab = store.undoLastDelete(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'nothing to undo' });
  res.json(tab);
});

app.get('/api/tabs/:tabId', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const cells = store.getCells(tab.id);
  const cache = new Map<string, number>();
  const grid: {
    row: number;
    col: number;
    value: string;
    formula?: string;
    computed: number;
    updatedAt?: number;
    updatedBy?: string;
  }[] = [];

  for (let r = 0; r < tab.rows; r++) {
    for (let c = 0; c < tab.cols; c++) {
      const key = `${r}_${c}`;
      const cell = cells[key];
      grid.push({
        row: r,
        col: c,
        value: cell?.value ?? '',
        formula: cell?.formula,
        computed: computeCell(tab.id, r, c, cache),
        updatedAt: cell?.updatedAt,
        updatedBy: cell?.updatedBy,
      });
    }
  }

  const formatMap = store.getColumnFormats(tab.id);
  const columnFormats: ColumnFormat[] = [];
  for (let c = 0; c < tab.cols; c++) {
    columnFormats.push(formatMap[c] ?? 'text');
  }

  const widthMap = store.getColumnWidths(tab.id);
  const columnWidths: (number | null)[] = [];
  for (let c = 0; c < tab.cols; c++) {
    columnWidths.push(widthMap[c] ?? null);
  }

  const merges = store.getMerges(tab.id);

  res.json({ ...tab, cells: grid, columnFormats, columnWidths, merges });
});

app.put('/api/tabs/:tabId', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const tab = store.renameTab(req.params.tabId, name.trim());
  if (!tab) return res.status(404).json({ error: 'tab not found' });
  res.json(tab);
});

app.delete('/api/tabs/:tabId', (req, res) => {
  store.deleteTab(req.params.tabId);
  res.status(204).end();
});

app.put('/api/tabs/:tabId/columns/:col/format', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const col = Number(req.params.col);
  if (!Number.isInteger(col) || col < 0 || col >= tab.cols) {
    return res.status(400).json({ error: 'invalid column' });
  }

  const { format } = req.body as { format?: ColumnFormat };
  if (!format || !COLUMN_FORMATS.includes(format)) {
    return res.status(400).json({ error: `format must be one of ${COLUMN_FORMATS.join(', ')}` });
  }

  store.setColumnFormat(tab.id, col, format);
  res.json({ col, format });
});

const MIN_COLUMN_WIDTH = 40;
const MAX_COLUMN_WIDTH = 400;

app.put('/api/tabs/:tabId/columns/:col/width', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const col = Number(req.params.col);
  if (!Number.isInteger(col) || col < 0 || col >= tab.cols) {
    return res.status(400).json({ error: 'invalid column' });
  }

  const { width } = req.body as { width?: number | null };
  if (width !== null && width !== undefined) {
    if (!Number.isInteger(width) || width < MIN_COLUMN_WIDTH || width > MAX_COLUMN_WIDTH) {
      return res.status(400).json({ error: `width must be between ${MIN_COLUMN_WIDTH} and ${MAX_COLUMN_WIDTH}, or null` });
    }
  }

  store.setColumnWidth(tab.id, col, width ?? null);
  res.json({ col, width: width ?? null });
});

app.put('/api/tabs/:tabId/merges', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const { anchorRow, anchorCol, rowSpan, colSpan } = req.body as {
    anchorRow: number;
    anchorCol: number;
    rowSpan: number;
    colSpan: number;
  };

  if (
    !Number.isInteger(anchorRow) ||
    !Number.isInteger(anchorCol) ||
    !Number.isInteger(rowSpan) ||
    !Number.isInteger(colSpan) ||
    rowSpan < 1 ||
    colSpan < 1 ||
    anchorRow < 0 ||
    anchorCol < 0 ||
    anchorRow + rowSpan > tab.rows ||
    anchorCol + colSpan > tab.cols
  ) {
    return res.status(400).json({ error: 'invalid merge range' });
  }

  if (rowSpan === 1 && colSpan === 1) {
    store.deleteMerge(tab.id, anchorRow, anchorCol);
    return res.json({ anchorRow, anchorCol, rowSpan: 1, colSpan: 1 });
  }

  const next: Merge = { anchorRow, anchorCol, rowSpan, colSpan };
  const overlaps = store
    .getMerges(tab.id)
    .filter((m) => !(m.anchorRow === anchorRow && m.anchorCol === anchorCol))
    .some((m) => mergesOverlap(m, next));
  if (overlaps) {
    return res.status(409).json({ error: 'overlaps an existing merged range' });
  }

  store.setMerge(tab.id, anchorRow, anchorCol, rowSpan, colSpan);
  res.json(next);
});

app.put('/api/tabs/:tabId/cells', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const { row, col, value, formula, baseUpdatedAt } = req.body as {
    row: number;
    col: number;
    value?: string;
    formula?: string;
    baseUpdatedAt?: number | null;
  };

  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    col < 0 ||
    row >= tab.rows ||
    col >= tab.cols
  ) {
    return res.status(400).json({ error: `row must be 0..${tab.rows - 1}, col must be 0..${tab.cols - 1}` });
  }

  // 동시 편집 충돌: 클라이언트가 불러온 뒤(baseUpdatedAt) 다른 사람이 이 셀을 먼저 고쳤으면 거절합니다.
  const hasBase = Object.prototype.hasOwnProperty.call(req.body, 'baseUpdatedAt');
  const currentMeta = store.getCellMeta(tab.id, row, col);
  if (hasBase && currentMeta != null && (baseUpdatedAt == null || currentMeta > baseUpdatedAt)) {
    const current = store.getCells(tab.id)[`${row}_${col}`];
    const computed = computeCell(tab.id, row, col, new Map());
    return res.status(409).json({
      error: 'conflict',
      current: {
        row,
        col,
        value: current?.value ?? '',
        formula: current?.formula,
        computed,
        updatedAt: currentMeta,
        updatedBy: current?.updatedBy,
      },
    });
  }

  const data: CellData = { value: value ?? '', formula };
  const updatedAt = store.recordAndSetCell(tab.id, row, col, data, getEditor(req));

  const computed = computeCell(tab.id, row, col, new Map());
  res.json({ row, col, ...data, computed, updatedAt, updatedBy: getEditor(req) });
});

app.get('/api/tabs/:tabId/history', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  res.json(store.listHistory(tab.id, limit));
});

app.post('/api/tabs/:tabId/history/:id/revert', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid history id' });

  const result = store.revertCell(tab.id, id, getEditor(req));
  if (!result.ok) {
    if (result.reason === 'not_found') return res.status(404).json({ error: 'history entry not found' });
    return res.status(409).json({ error: 'stale', message: '그 사이 다른 수정이 있어 되돌릴 수 없어요' });
  }

  const computed = computeCell(tab.id, result.row, result.col, new Map());
  res.json({ ...result, computed });
});

// ── 메인화면: 기념일 / D-day ──────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/events', (_req, res) => {
  res.json(store.listEvents());
});

app.post('/api/events', (req, res) => {
  const { title, date } = req.body as { title?: string; date?: string };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  res.status(201).json(store.createEvent(title.trim(), date));
});

app.put('/api/events/:id', (req, res) => {
  const { title, date } = req.body as { title?: string; date?: string };
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: 'title cannot be empty' });
  if (date !== undefined && !DATE_RE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const updated = store.updateEvent(req.params.id, {
    title: title?.trim(),
    date,
  });
  if (!updated) return res.status(404).json({ error: 'event not found' });
  res.json(updated);
});

app.delete('/api/events/:id', (req, res) => {
  store.deleteEvent(req.params.id);
  res.status(204).end();
});

// ── 공유 메모장 ─────────────────────────────────────────
app.get('/api/memos', (_req, res) => {
  res.json(store.listMemos());
});

app.post('/api/memos', (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  res.status(201).json(store.createMemo(title.trim()));
});

app.get('/api/memos/:id', (req, res) => {
  const memo = store.getMemo(req.params.id);
  if (!memo) return res.status(404).json({ error: 'memo not found' });
  res.json(memo);
});

app.put('/api/memos/:id', (req, res) => {
  const { title, content, baseUpdatedAt } = req.body as {
    title?: string;
    content?: string;
    baseUpdatedAt?: number | null;
  };
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: 'title cannot be empty' });

  const meta = store.getMemoMeta(req.params.id);
  if (meta === null && !store.getMemo(req.params.id)) {
    return res.status(404).json({ error: 'memo not found' });
  }

  // 동시 편집 충돌: 불러온 뒤 상대가 먼저 저장했으면 거절합니다.
  const hasBase = Object.prototype.hasOwnProperty.call(req.body, 'baseUpdatedAt');
  if (hasBase && meta != null && (baseUpdatedAt == null || meta > baseUpdatedAt)) {
    const current = store.getMemo(req.params.id);
    return res.status(409).json({
      error: 'conflict',
      current: {
        id: current?.id,
        title: current?.title,
        content: current?.content,
        updatedAt: current?.updatedAt,
        updatedBy: current?.updatedBy,
      },
    });
  }

  const updated = store.updateMemo(
    req.params.id,
    { title: title?.trim(), content },
    getEditor(req)
  );
  if (!updated) return res.status(404).json({ error: 'memo not found' });
  res.json(updated);
});

app.delete('/api/memos/:id', (req, res) => {
  store.deleteMemo(req.params.id);
  res.status(204).end();
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`memo-excel backend listening on http://localhost:${PORT}`);
});
