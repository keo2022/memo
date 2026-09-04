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
  // 마지막으로 수정된 시각(ms)과 수정한 사람. 동시 편집 충돌 감지·변경 이력에 씁니다.
  updatedAt?: number;
  updatedBy?: string;
}

export type ColumnFormat = 'text' | 'checkbox' | 'number';

export interface Merge {
  anchorRow: number;
  anchorCol: number;
  rowSpan: number;
  colSpan: number;
}

// 기념일 하나에 메모/엑셀시트를 연결한 항목. kind별 refId는 memo.id 또는 sheet.id.
export interface EventLink {
  kind: 'memo' | 'sheet';
  refId: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  order: number;
  links: EventLink[];
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

// 셀 하나가 바뀔 때마다 남기는 감사 로그 1건.
export interface HistoryEntry {
  id: number;
  tabId: string;
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
