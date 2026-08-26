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

function computeCell(tabId: string, row: number, col: number, cache: Map<string, number>): number {
  const key = `${row}_${col}`;
  if (cache.has(key)) return cache.get(key)!;

  const cells = store.getCells(tabId);
  const cell = cells[key];
  if (!cell) return 0;

  if (cell.formula) {
    const value = evaluateFormula(cell.formula, (r, c) => computeCell(tabId, r, c, cache));
    cache.set(key, value);
    return value;
  }

  const num = Number(cell.value);
  const value = cell.value !== '' && !isNaN(num) ? num : 0;
  cache.set(key, value);
  return value;
}

app.get('/api/sheets', (_req, res) => {
  res.json(store.listSheets());
});

app.post('/api/sheets', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createSheet(name));
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

app.get('/api/tabs/:tabId', (req, res) => {
  const tab = store.getTab(req.params.tabId);
  if (!tab) return res.status(404).json({ error: 'tab not found' });

  const cells = store.getCells(tab.id);
  const cache = new Map<string, number>();
  const grid: { row: number; col: number; value: string; formula?: string; computed: number }[] = [];

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

  const { row, col, value, formula } = req.body as {
    row: number;
    col: number;
    value?: string;
    formula?: string;
  };
  const data: CellData = { value: value ?? '', formula };
  store.setCell(tab.id, row, col, data);

  const cache = new Map<string, number>();
  const computed = computeCell(tab.id, row, col, cache);
  res.json({ row, col, ...data, computed });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`memo-excel backend listening on http://localhost:${PORT}`);
});
