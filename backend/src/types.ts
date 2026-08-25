export interface Menu {
  id: string;
  name: string;
  order: number;
}

export interface Sheet {
  id: string;
  menuId: string;
  name: string;
  rows: number;
  cols: number;
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
