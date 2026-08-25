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

export interface SheetDetail extends Sheet {
  cells: CellInfo[];
  columnFormats: ColumnFormat[];
  columnWidths: (number | null)[];
  merges: Merge[];
}
