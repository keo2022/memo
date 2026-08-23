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
