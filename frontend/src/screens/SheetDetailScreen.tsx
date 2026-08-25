import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { CellInfo, ColumnFormat, Merge, Sheet, SheetDetail } from '../types';
import { colors, radius, spacing, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetDetail'>;

const CELL_WIDTH = 96;
const ROW_HEADER_WIDTH = 44;
const CELL_HEIGHT = 46;
const MIN_COL_WIDTH = 40;
const MAX_COL_WIDTH = 240;
const DEFAULT_COL_WIDTH = 104;
const CHECKBOX_COL_WIDTH = 64;
const WIDTH_STEP = 12;
const CHAR_WIDTH_ESTIMATE = 9;
const CELL_HORIZONTAL_PADDING = 20;

const FORMAT_OPTIONS: { format: ColumnFormat; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { format: 'text', label: '기본', description: '자유롭게 값이나 수식을 입력', icon: 'text-outline' },
  { format: 'checkbox', label: '체크(O/X)', description: '탭 한 번으로 O/X 선택', icon: 'checkbox-outline' },
  { format: 'number', label: '숫자', description: '백/천/만 단위 버튼으로 빠르게 입력', icon: 'calculator-outline' },
];

const NUMBER_UNITS: { label: string; multiplier: number }[] = [
  { label: '백', multiplier: 100 },
  { label: '천', multiplier: 1000 },
  { label: '만', multiplier: 10000 },
];

function colLabel(col: number): string {
  let n = col + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function formatNumberDisplay(raw: string): string {
  const num = Number(raw);
  if (raw === '' || isNaN(num)) return raw;
  return num.toLocaleString('ko-KR');
}

type CellPlan = { kind: 'skip' } | { kind: 'cell'; rowSpan: number; colSpan: number };

// 병합 범위를 앵커 셀(왼쪽 위)만 렌더링하고 나머지는 건너뛰도록 배치도를 계산합니다.
// 데이터 칸은 절대 위치로 배치하기 때문에(그리드가 flex row로 쌓이지 않음),
// 병합된 앵커 셀이 커져도 다른 행/열의 위치에는 영향을 주지 않습니다.
function buildMergePlan(merges: Merge[], rows: number, cols: number): CellPlan[][] {
  const plan: CellPlan[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): CellPlan => ({ kind: 'cell', rowSpan: 1, colSpan: 1 }))
  );
  merges.forEach((m) => {
    for (let r = m.anchorRow; r < m.anchorRow + m.rowSpan && r < rows; r++) {
      for (let c = m.anchorCol; c < m.anchorCol + m.colSpan && c < cols; c++) {
        plan[r][c] =
          r === m.anchorRow && c === m.anchorCol
            ? { kind: 'cell', rowSpan: m.rowSpan, colSpan: m.colSpan }
            : { kind: 'skip' };
      }
    }
  });
  return plan;
}

export default function SheetDetailScreen({ route, navigation }: Props) {
  const { sheetId } = route.params;
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [siblings, setSiblings] = useState<Sheet[]>([]);
  const [selected, setSelected] = useState<CellInfo | null>(null);
  const [draft, setDraft] = useState('');
  const [resizing, setResizing] = useState(false);
  const [formatPickerCol, setFormatPickerCol] = useState<number | null>(null);
  const [insertPrompt, setInsertPrompt] = useState<{ axis: 'row' | 'col'; index: number } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ row: number; col: number; rowSpan: number; colSpan: number } | null>(
    null
  );

  const loadSheet = useCallback(async () => {
    try {
      const detail = await api.getSheet(sheetId);
      setSheet(detail);
      setSiblings(await api.getSheets(detail.menuId));
    } catch (e) {
      Alert.alert('시트를 불러오지 못했습니다', String(e));
    }
  }, [sheetId]);

  const switchSheet = (target: Sheet) => {
    if (target.id === sheetId) return;
    navigation.setParams({ sheetId: target.id, sheetName: target.name });
  };

  useFocusEffect(
    useCallback(() => {
      loadSheet();
    }, [loadSheet])
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, CellInfo>();
    sheet?.cells.forEach((c) => map.set(`${c.row}_${c.col}`, c));
    return map;
  }, [sheet]);

  const mergePlan = useMemo(
    () => buildMergePlan(sheet?.merges ?? [], sheet?.rows ?? 0, sheet?.cols ?? 0),
    [sheet]
  );

  // 열 너비: 수동으로 지정해둔 값이 있으면 그걸 쓰고, 없으면 그 열에서 가장 긴 값 기준으로 자동 계산합니다.
  const colWidths = useMemo(() => {
    if (!sheet) return [];
    const maxLen = Array.from({ length: sheet.cols }, (_, c) => colLabel(c).length);
    sheet.cells.forEach((cell) => {
      const format = sheet.columnFormats[cell.col] ?? 'text';
      if (format === 'checkbox') return;
      const display = cell.formula
        ? format === 'number'
          ? formatNumberDisplay(String(cell.computed))
          : String(cell.computed)
        : format === 'number'
          ? formatNumberDisplay(cell.value)
          : cell.value;
      maxLen[cell.col] = Math.max(maxLen[cell.col], display.length);
    });
    return Array.from({ length: sheet.cols }, (_, col) => {
      const override = sheet.columnWidths[col];
      if (override != null) return override;
      if ((sheet.columnFormats[col] ?? 'text') === 'checkbox') return CHECKBOX_COL_WIDTH;
      const estimated = maxLen[col] * CHAR_WIDTH_ESTIMATE + CELL_HORIZONTAL_PADDING;
      return Math.min(MAX_COL_WIDTH, Math.max(DEFAULT_COL_WIDTH, estimated));
    });
  }, [sheet]);

  // colOffsets[i] = 0..i-1번 열 너비의 합 (i번 열이 시작하는 x좌표). 마지막 원소는 전체 너비.
  const colOffsets = useMemo(() => {
    const offsets = [0];
    colWidths.forEach((w) => offsets.push(offsets[offsets.length - 1] + w));
    return offsets;
  }, [colWidths]);

  const openCell = (row: number, col: number) => {
    const cell = cellMap.get(`${row}_${col}`);
    const info: CellInfo = cell ?? { row, col, value: '', computed: 0 };

    if (sheet?.columnFormats[col] === 'checkbox') {
      const next = info.value === 'O' ? 'X' : info.value === 'X' ? '' : 'O';
      api
        .updateCell(sheetId, row, col, next)
        .then(() => loadSheet())
        .catch((e) => Alert.alert('저장 실패', String(e)));
      return;
    }

    setSelected(info);
    setDraft(info.formula ? info.formula : info.value);
  };

  const applyUnit = (multiplier: number) => {
    const base = Number(draft.replace(/,/g, ''));
    const next = (isNaN(base) ? 0 : base) * multiplier;
    setDraft(String(next));
  };

  const changeColumnFormat = async (format: ColumnFormat) => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnFormat(sheetId, formatPickerCol, format);
      loadSheet();
    } catch (e) {
      Alert.alert('열 포맷 변경 실패', String(e));
    }
  };

  const adjustColumnWidth = async (delta: number) => {
    if (formatPickerCol === null) return;
    const current = colWidths[formatPickerCol] ?? MIN_COL_WIDTH;
    const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round(current + delta)));
    try {
      await api.setColumnWidth(sheetId, formatPickerCol, next);
      loadSheet();
    } catch (e) {
      Alert.alert('열 너비 변경 실패', String(e));
    }
  };

  const resetColumnWidthAuto = async () => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnWidth(sheetId, formatPickerCol, null);
      loadSheet();
    } catch (e) {
      Alert.alert('열 너비 초기화 실패', String(e));
    }
  };

  const resetColumnWidthDefault = async () => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnWidth(sheetId, formatPickerCol, DEFAULT_COL_WIDTH);
      loadSheet();
    } catch (e) {
      Alert.alert('열 너비 초기화 실패', String(e));
    }
  };

  const openMergeModal = (row: number, col: number) => {
    const existing = sheet?.merges.find((m) => m.anchorRow === row && m.anchorCol === col);
    setMergeTarget({ row, col, rowSpan: existing?.rowSpan ?? 1, colSpan: existing?.colSpan ?? 1 });
  };

  const adjustMergeSpan = (axis: 'rowSpan' | 'colSpan', delta: number) => {
    if (!mergeTarget || !sheet) return;
    const max = axis === 'rowSpan' ? sheet.rows - mergeTarget.row : sheet.cols - mergeTarget.col;
    setMergeTarget({ ...mergeTarget, [axis]: Math.min(max, Math.max(1, mergeTarget[axis] + delta)) });
  };

  const applyMerge = async () => {
    if (!mergeTarget) return;
    try {
      await api.setMerge(sheetId, mergeTarget.row, mergeTarget.col, mergeTarget.rowSpan, mergeTarget.colSpan);
      setMergeTarget(null);
      loadSheet();
    } catch (e) {
      Alert.alert('병합 실패', String(e));
    }
  };

  const unmerge = async () => {
    if (!mergeTarget) return;
    try {
      await api.setMerge(sheetId, mergeTarget.row, mergeTarget.col, 1, 1);
      setMergeTarget(null);
      loadSheet();
    } catch (e) {
      Alert.alert('병합 해제 실패', String(e));
    }
  };

  const insertRowAt = async (index: number) => {
    if (resizing) return;
    setResizing(true);
    try {
      await api.insertRow(sheetId, index);
      await loadSheet();
    } catch (e) {
      Alert.alert('행 추가 실패', String(e));
    } finally {
      setResizing(false);
    }
  };

  const insertColumnAt = async (index: number) => {
    if (resizing) return;
    setResizing(true);
    try {
      await api.insertColumn(sheetId, index);
      await loadSheet();
    } catch (e) {
      Alert.alert('열 추가 실패', String(e));
    } finally {
      setResizing(false);
    }
  };

  const promptInsertRow = (row: number) => setInsertPrompt({ axis: 'row', index: row });
  const promptInsertColumn = (col: number) => setInsertPrompt({ axis: 'col', index: col });

  const confirmInsert = (position: 'before' | 'after') => {
    if (!insertPrompt) return;
    const target = position === 'before' ? insertPrompt.index : insertPrompt.index + 1;
    const axis = insertPrompt.axis;
    setInsertPrompt(null);
    if (axis === 'row') insertRowAt(target);
    else insertColumnAt(target);
  };

  const saveCell = async () => {
    if (!selected) return;
    const isFormula = draft.trim().startsWith('=');
    try {
      await api.updateCell(
        sheetId,
        selected.row,
        selected.col,
        isFormula ? '' : draft,
        isFormula ? draft.trim() : undefined
      );
      setSelected(null);
      loadSheet();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    }
  };

  if (!sheet) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </View>
    );
  }

  const renderDataCell = (row: number, col: number) => {
    const plan = mergePlan[row][col];
    if (plan.kind === 'skip') return null;

    const cell = cellMap.get(`${row}_${col}`);
    const format = sheet.columnFormats[col] ?? 'text';
    const isFormula = !!cell?.formula;
    const rawValue = cell?.value ?? '';
    const positionStyle = {
      position: 'absolute' as const,
      left: colOffsets[col],
      top: row * CELL_HEIGHT,
      width: colOffsets[col + plan.colSpan] - colOffsets[col],
      height: CELL_HEIGHT * plan.rowSpan,
    };

    if (format === 'checkbox') {
      return (
        <TouchableOpacity
          key={`${row}_${col}`}
          style={[styles.cell, positionStyle]}
          activeOpacity={0.6}
          onPress={() => openCell(row, col)}
          onLongPress={() => openMergeModal(row, col)}
        >
          {rawValue === 'O' && <Ionicons name="checkmark-circle" size={30} color={colors.primary} />}
          {rawValue === 'X' && <Ionicons name="close-circle" size={30} color={colors.danger} />}
        </TouchableOpacity>
      );
    }

    let display: string;
    if (isFormula) {
      display = format === 'number' ? formatNumberDisplay(String(cell?.computed)) : String(cell?.computed);
    } else {
      display = format === 'number' ? formatNumberDisplay(rawValue) : rawValue;
    }

    return (
      <TouchableOpacity
        key={`${row}_${col}`}
        style={[styles.cell, isFormula && styles.cellFormula, positionStyle]}
        activeOpacity={0.6}
        onPress={() => openCell(row, col)}
        onLongPress={() => openMergeModal(row, col)}
      >
        <Text numberOfLines={1} style={[styles.cellText, isFormula && styles.cellTextFormula]}>
          {display}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {siblings.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {siblings.map((s) => {
            const active = s.id === sheetId;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => switchSheet(s)}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]} numberOfLines={1}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.gridArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.row}>
              <View style={[styles.cell, styles.headerCell, styles.rowHeaderCell]} />
              {Array.from({ length: sheet.cols }).map((_, col) => {
                const format = sheet.columnFormats[col] ?? 'text';
                const formatMeta = FORMAT_OPTIONS.find((f) => f.format === format);
                return (
                  <TouchableOpacity
                    key={col}
                    style={[styles.cell, styles.headerCell, { width: colWidths[col] }]}
                    activeOpacity={0.6}
                    onPress={() => setFormatPickerCol(col)}
                    onLongPress={() => promptInsertColumn(col)}
                  >
                    <Text style={styles.headerText}>{colLabel(col)}</Text>
                    {format !== 'text' && formatMeta && (
                      <Ionicons name={formatMeta.icon} size={11} color={colors.primaryDark} style={styles.headerFormatIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row' }}>
                <View>
                  {Array.from({ length: sheet.rows }).map((_, row) => (
                    <TouchableOpacity
                      key={row}
                      style={[styles.cell, styles.headerCell, styles.rowHeaderCell]}
                      activeOpacity={0.6}
                      onLongPress={() => promptInsertRow(row)}
                    >
                      <Text style={styles.headerText}>{row + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ width: colOffsets[sheet.cols], height: sheet.rows * CELL_HEIGHT }}>
                  {Array.from({ length: sheet.rows }).flatMap((_, row) =>
                    Array.from({ length: sheet.cols }).map((_, col) => renderDataCell(row, col))
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>
                  {selected ? `${colLabel(selected.col)}${selected.row + 1}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={draft}
              onChangeText={setDraft}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            {selected && sheet.columnFormats[selected.col] === 'number' && !draft.trim().startsWith('=') && (
              <View style={styles.unitRow}>
                {NUMBER_UNITS.map((u) => (
                  <TouchableOpacity key={u.label} style={styles.unitButton} onPress={() => applyUnit(u.multiplier)}>
                    <Text style={styles.unitButtonText}>×{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.modalHint}>지원 함수: SUM · AVERAGE · MAX · MIN</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSelected(null)} style={[styles.modalButton, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCell} style={[styles.modalButton, styles.modalPrimary]}>
                <Text style={styles.modalPrimaryText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={formatPickerCol !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFormatPickerCol(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.formatPickerTitle}>
                {formatPickerCol !== null ? `${colLabel(formatPickerCol)}열 포맷` : ''}
              </Text>
              <TouchableOpacity onPress={() => setFormatPickerCol(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {FORMAT_OPTIONS.map((opt) => {
              const active = formatPickerCol !== null && (sheet.columnFormats[formatPickerCol] ?? 'text') === opt.format;
              return (
                <TouchableOpacity
                  key={opt.format}
                  style={[styles.formatOption, active && styles.formatOptionActive]}
                  onPress={() => changeColumnFormat(opt.format)}
                >
                  <View style={styles.formatOptionIconWrap}>
                    <Ionicons name={opt.icon} size={18} color={colors.primaryDark} />
                  </View>
                  <View style={styles.formatOptionTextWrap}>
                    <Text style={styles.formatOptionLabel}>{opt.label}</Text>
                    <Text style={styles.formatOptionDesc}>{opt.description}</Text>
                  </View>
                  {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <View style={styles.widthSection}>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>열 너비</Text>
                <View style={styles.stepperControl}>
                  <TouchableOpacity style={styles.stepperButton} onPress={() => adjustColumnWidth(-WIDTH_STEP)}>
                    <Ionicons name="remove" size={16} color={colors.primaryDark} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>
                    {formatPickerCol !== null ? Math.round(colWidths[formatPickerCol] ?? 0) : ''}
                  </Text>
                  <TouchableOpacity style={styles.stepperButton} onPress={() => adjustColumnWidth(WIDTH_STEP)}>
                    <Ionicons name="add" size={16} color={colors.primaryDark} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.widthLinkRow}>
                <TouchableOpacity onPress={resetColumnWidthDefault} hitSlop={6}>
                  <Text style={styles.autoFitLink}>기본 크기로</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetColumnWidthAuto} hitSlop={6}>
                  <Text style={styles.autoFitLink}>내용에 맞게 자동 조정</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!mergeTarget} transparent animationType="fade" onRequestClose={() => setMergeTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.formatPickerTitle}>
                {mergeTarget ? `${colLabel(mergeTarget.col)}${mergeTarget.row + 1} 셀 병합` : ''}
              </Text>
              <TouchableOpacity onPress={() => setMergeTarget(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>아래로 합칠 행</Text>
              <View style={styles.stepperControl}>
                <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMergeSpan('rowSpan', -1)}>
                  <Ionicons name="remove" size={16} color={colors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{mergeTarget?.rowSpan ?? 1}</Text>
                <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMergeSpan('rowSpan', 1)}>
                  <Ionicons name="add" size={16} color={colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>오른쪽으로 합칠 열</Text>
              <View style={styles.stepperControl}>
                <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMergeSpan('colSpan', -1)}>
                  <Ionicons name="remove" size={16} color={colors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{mergeTarget?.colSpan ?? 1}</Text>
                <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMergeSpan('colSpan', 1)}>
                  <Ionicons name="add" size={16} color={colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.modalHint}>
              병합되면 왼쪽 위 셀의 값만 유지되고, 셀을 다시 길게 누르면 범위를 바꾸거나 해제할 수 있어요.
            </Text>

            <View style={styles.modalActions}>
              {mergeTarget && (mergeTarget.rowSpan > 1 || mergeTarget.colSpan > 1) && (
                <TouchableOpacity onPress={unmerge} style={[styles.modalButton, styles.modalCancel]}>
                  <Text style={styles.modalCancelText}>병합 해제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setMergeTarget(null)} style={[styles.modalButton, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyMerge} style={[styles.modalButton, styles.modalPrimary]}>
                <Text style={styles.modalPrimaryText}>적용</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!insertPrompt} transparent animationType="fade" onRequestClose={() => setInsertPrompt(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.formatPickerTitle}>
                {insertPrompt?.axis === 'row'
                  ? `${insertPrompt.index + 1}행 근처에 추가`
                  : insertPrompt
                    ? `${colLabel(insertPrompt.index)}열 근처에 추가`
                    : ''}
              </Text>
              <TouchableOpacity onPress={() => setInsertPrompt(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.formatOption} onPress={() => confirmInsert('before')}>
              <View style={styles.formatOptionIconWrap}>
                <Ionicons
                  name={insertPrompt?.axis === 'row' ? 'arrow-up' : 'arrow-back'}
                  size={18}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.formatOptionTextWrap}>
                <Text style={styles.formatOptionLabel}>
                  {insertPrompt?.axis === 'row' ? '위에 삽입' : '왼쪽에 삽입'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.formatOption, styles.formatOptionLast]} onPress={() => confirmInsert('after')}>
              <View style={styles.formatOptionIconWrap}>
                <Ionicons
                  name={insertPrompt?.axis === 'row' ? 'arrow-down' : 'arrow-forward'}
                  size={18}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.formatOptionTextWrap}>
                <Text style={styles.formatOptionLabel}>
                  {insertPrompt?.axis === 'row' ? '아래에 삽입' : '오른쪽에 삽입'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  tabBar: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabPillTextActive: { color: colors.white },
  gridArea: { flex: 1 },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
  },
  cellFormula: { backgroundColor: colors.primarySoft },
  headerCell: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder },
  rowHeaderCell: { width: ROW_HEADER_WIDTH },
  headerText: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  headerFormatIcon: { marginTop: 2 },
  cellText: { fontSize: 14, color: colors.textPrimary },
  cellTextFormula: { color: colors.primaryDark, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18,33,23,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.floating,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  modalBadgeText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.sm, marginLeft: spacing.sm },
  modalCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.textSecondary, fontWeight: '600' },
  modalPrimary: { backgroundColor: colors.primary },
  modalPrimaryText: { color: colors.white, fontWeight: '700' },
  unitRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  unitButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: 'center',
  },
  unitButtonText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  formatPickerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formatOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  formatOptionLast: { marginBottom: 0 },
  formatOptionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  formatOptionTextWrap: { flex: 1 },
  formatOptionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  formatOptionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  widthSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm },
  widthLinkRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xs },
  autoFitLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepperLabel: { fontSize: 14, color: colors.textPrimary },
  stepperControl: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { minWidth: 24, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
