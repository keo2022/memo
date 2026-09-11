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

// 삭제됐지만 아직 완전히 지워지지 않아 복원 가능한 항목(휴지통 목록용).
export interface DeletedSheet extends Sheet {
  deletedAt: number;
  deletedBy?: string;
}

export interface DeletedTab extends Tab {
  deletedAt: number;
  deletedBy?: string;
}

export interface DeletedMemo {
  id: string;
  title: string;
  deletedAt: number;
  deletedBy?: string;
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
  pinned: boolean; // 공지처럼 맨 위에 고정
  time?: string; // 'HH:MM' (24시간). 없으면 하루 종일.
  location?: string;
  note?: string;
  updatedAt?: number;
  updatedBy?: string;
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

// 메모 본문이 바뀔 때마다 남기는 스냅샷 1건. next_content = 그 저장 직후의 전체 본문.
export interface MemoHistoryEntry {
  id: number;
  content: string; // 이 시점의 본문 스냅샷 (되돌리면 이 내용으로 복원)
  prevContent: string;
  editor?: string;
  kind: 'edit' | 'revert';
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
