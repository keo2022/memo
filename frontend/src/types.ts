export interface Sheet {
  id: string;
  name: string;
  order: number;
}

export interface Tab {
  id: string;
  sheetId: string;
  name: string;
  rows: number;
  cols: number;
  order: number;
}

export interface CellInfo {
  row: number;
  col: number;
  value: string;
  formula?: string;
  computed: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  order: number;
}

export interface MemoSummary {
  id: string;
  title: string;
  order: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface Memo extends MemoSummary {
  content: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: number;
  row: number;
  col: number;
  prevValue: string;
  prevFormula?: string;
  nextValue: string;
  nextFormula?: string;
  editor?: string;
  kind: 'edit' | 'revert';
  createdAt: number;
}

export type ColumnFormat = 'text' | 'checkbox' | 'number';

export interface Merge {
  anchorRow: number;
  anchorCol: number;
  rowSpan: number;
  colSpan: number;
}

export interface TabDetail extends Tab {
  cells: CellInfo[];
  columnFormats: ColumnFormat[];
  columnWidths: (number | null)[];
  merges: Merge[];
}
