import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Menu, Sheet, CellData } from '../types';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'db.json');

interface DB {
  menus: Menu[];
  sheets: Sheet[];
  cells: Record<string, Record<string, CellData>>; // sheetId -> "row_col" -> CellData
}

function defaultDb(): DB {
  return { menus: [], sheets: [], cells: {} };
}

function save(db: DB) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function load(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDb();
    save(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DB;
}

const db = load();

export const store = {
  listMenus(): Menu[] {
    return db.menus;
  },
  createMenu(name: string): Menu {
    const menu: Menu = { id: randomUUID(), name, order: db.menus.length };
    db.menus.push(menu);
    save(db);
    return menu;
  },
  listSheets(menuId: string): Sheet[] {
    return db.sheets.filter((s) => s.menuId === menuId);
  },
  createSheet(menuId: string, name: string, rows = 10, cols = 6): Sheet {
    const sheet: Sheet = { id: randomUUID(), menuId, name, rows, cols };
    db.sheets.push(sheet);
    db.cells[sheet.id] = {};
    save(db);
    return sheet;
  },
  getSheet(sheetId: string): Sheet | undefined {
    return db.sheets.find((s) => s.id === sheetId);
  },
  getCells(sheetId: string): Record<string, CellData> {
    return db.cells[sheetId] ?? {};
  },
  setCell(sheetId: string, row: number, col: number, data: CellData) {
    if (!db.cells[sheetId]) db.cells[sheetId] = {};
    db.cells[sheetId][`${row}_${col}`] = data;
    save(db);
  },
};
