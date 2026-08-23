import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('excel_memo.db');

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS menus (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    order_num INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY NOT NULL,
    menu_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rows INTEGER NOT NULL,
    cols INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cells (
    sheet_id TEXT NOT NULL,
    row INTEGER NOT NULL,
    col INTEGER NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    formula TEXT,
    PRIMARY KEY (sheet_id, row, col)
  );
`);

export default db;
