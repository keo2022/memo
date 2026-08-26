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

export interface CellData {
  value: string;
  formula?: string;
}

export type ColumnFormat = 'text' | 'checkbox' | 'number';

export interface Merge {
  anchorRow: number;
  anchorCol: number;
  rowSpan: number;
  colSpan: number;
}
