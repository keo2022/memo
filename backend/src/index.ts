import express from 'express';
import cors from 'cors';
import { store } from './data/store';
import { evaluateFormula } from './formula/evaluate';
import { CellData } from './types';

const app = express();
app.use(cors());
app.use(express.json());

function computeCell(sheetId: string, row: number, col: number, cache: Map<string, number>): number {
  const key = `${row}_${col}`;
  if (cache.has(key)) return cache.get(key)!;

  const cells = store.getCells(sheetId);
  const cell = cells[key];
  if (!cell) return 0;

  if (cell.formula) {
    const value = evaluateFormula(cell.formula, (r, c) => computeCell(sheetId, r, c, cache));
    cache.set(key, value);
    return value;
  }

  const num = Number(cell.value);
  const value = cell.value !== '' && !isNaN(num) ? num : 0;
  cache.set(key, value);
  return value;
}

app.get('/api/menus', (_req, res) => {
  res.json(store.listMenus());
});

app.post('/api/menus', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createMenu(name));
});

app.get('/api/menus/:menuId/sheets', (req, res) => {
  res.json(store.listSheets(req.params.menuId));
});

app.post('/api/menus/:menuId/sheets', (req, res) => {
  const { name, rows, cols } = req.body as { name?: string; rows?: number; cols?: number };
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(store.createSheet(req.params.menuId, name, rows, cols));
});

app.get('/api/sheets/:sheetId', (req, res) => {
  const sheet = store.getSheet(req.params.sheetId);
  if (!sheet) return res.status(404).json({ error: 'sheet not found' });

  const cells = store.getCells(sheet.id);
  const cache = new Map<string, number>();
  const grid: { row: number; col: number; value: string; formula?: string; computed: number }[] = [];

  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const key = `${r}_${c}`;
      const cell = cells[key];
      grid.push({
        row: r,
        col: c,
        value: cell?.value ?? '',
        formula: cell?.formula,
        computed: computeCell(sheet.id, r, c, cache),
      });
    }
  }

  res.json({ ...sheet, cells: grid });
});

app.put('/api/sheets/:sheetId/cells', (req, res) => {
  const sheet = store.getSheet(req.params.sheetId);
  if (!sheet) return res.status(404).json({ error: 'sheet not found' });

  const { row, col, value, formula } = req.body as {
    row: number;
    col: number;
    value?: string;
    formula?: string;
  };
  const data: CellData = { value: value ?? '', formula };
  store.setCell(sheet.id, row, col, data);

  const cache = new Map<string, number>();
  const computed = computeCell(sheet.id, row, col, cache);
  res.json({ row, col, ...data, computed });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`memo-excel backend listening on http://localhost:${PORT}`);
});
