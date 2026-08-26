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
