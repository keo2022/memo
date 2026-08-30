import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { CellInfo, ColumnFormat, Merge, Tab, TabDetail } from '../types';
import { colors, radius, spacing, shadow, fonts, motion, type } from '../theme';
import NamePromptModal from '../components/NamePromptModal';
import Snackbar from '../components/Snackbar';
import HeartBurst from '../components/HeartBurst';
import EmptyIllustration from '../components/illustrations/EmptyIllustration';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'TabDetail'>;

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

const FORMAT_OPTIONS: { format: ColumnFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { format: 'text', label: '기본', icon: 'text-outline' },
  { format: 'checkbox', label: '체크(O/X)', icon: 'checkbox-outline' },
  { format: 'number', label: '숫자', icon: 'calculator-outline' },
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

function TabPill({ name, active, onPress }: { name: string; active: boolean; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(active ? 1 : 0.96);
  React.useEffect(() => {
    scale.value = reduceMotion ? 1 : withSpring(active ? 1 : 0.96, motion.bouncy);
  }, [active, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.tabPill, active && styles.tabPillActive, style]}>
        <Text style={[styles.tabPillText, active && styles.tabPillTextActive]} numberOfLines={1}>
          {name}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabDetailScreen({ route, navigation }: Props) {
  const { sheetId, sheetName, tabId } = route.params;
  const [tab, setTab] = useState<TabDetail | null>(null);
  const [siblings, setSiblings] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTabModalVisible, setAddTabModalVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string } | null>(null);
  const [selected, setSelected] = useState<CellInfo | null>(null);
  const [draft, setDraft] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [formatPickerCol, setFormatPickerCol] = useState<number | null>(null);
  const [insertPrompt, setInsertPrompt] = useState<{ axis: 'row' | 'col'; index: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ axis: 'row' | 'col'; index: number } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ row: number; col: number; rowSpan: number; colSpan: number } | null>(
    null
  );
  const [burst, setBurst] = useState(0);
  const reduceMotion = useReduceMotion();

  const loadTab = useCallback(async () => {
    try {
      const tabsList = await api.getTabs(sheetId);
      setSiblings(tabsList);

      // tabId가 안 넘어왔으면(시트에 처음 들어온 경우) 첫번째 탭을 자동으로 보여줍니다.
      const targetId = tabId ?? tabsList[0]?.id;
      if (!targetId) {
        setTab(null);
        return;
      }

      const detail = await api.getTab(targetId);
      setTab(detail);
      if (tabId !== targetId) {
        navigation.setParams({ tabId: detail.id, tabName: detail.name });
      }
    } catch (e) {
      Alert.alert('탭을 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
    }
  }, [sheetId, tabId, navigation]);

  const switchTab = (target: Tab) => {
    if (target.id === tab?.id) return;
    navigation.setParams({ tabId: target.id, tabName: target.name });
  };

  const handleAddTab = async (name: string) => {
    try {
      const newTab = await api.createTab(sheetId, name);
      setAddTabModalVisible(false);
      navigation.setParams({ tabId: newTab.id, tabName: newTab.name });
      setSiblings(await api.getTabs(sheetId));
      setTab(await api.getTab(newTab.id));
    } catch (e) {
      Alert.alert('탭 생성 실패', String(e));
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTab();
    }, [loadTab])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => navigation.navigate('TabList', { sheetId, sheetName })} hitSlop={8}>
            <Ionicons name="list-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddTabModalVisible(true)} hitSlop={8}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, sheetId, sheetName]);

  const cellMap = useMemo(() => {
    const map = new Map<string, CellInfo>();
    tab?.cells.forEach((c) => map.set(`${c.row}_${c.col}`, c));
    return map;
  }, [tab]);

  const mergePlan = useMemo(
    () => buildMergePlan(tab?.merges ?? [], tab?.rows ?? 0, tab?.cols ?? 0),
    [tab]
  );

  // 열 너비: 수동으로 지정해둔 값이 있으면 그걸 쓰고, 없으면 그 열에서 가장 긴 값 기준으로 자동 계산합니다.
  const colWidths = useMemo(() => {
    if (!tab) return [];
    const maxLen = Array.from({ length: tab.cols }, (_, c) => colLabel(c).length);
    tab.cells.forEach((cell) => {
      const format = tab.columnFormats[cell.col] ?? 'text';
      // 체크 열이라도 O/X·빈칸이 아닌 자유 입력값이면 너비 계산에 포함합니다.
      if (format === 'checkbox' && (cell.value === 'O' || cell.value === 'X' || cell.value === '')) return;
      const display = cell.formula
        ? format === 'number'
          ? formatNumberDisplay(String(cell.computed))
          : String(cell.computed)
        : format === 'number'
          ? formatNumberDisplay(cell.value)
          : cell.value;
      maxLen[cell.col] = Math.max(maxLen[cell.col], display.length);
    });
    return Array.from({ length: tab.cols }, (_, col) => {
      const override = tab.columnWidths[col];
      if (override != null) return override;
      const isCheckbox = (tab.columnFormats[col] ?? 'text') === 'checkbox';
      // 체크 열에 자유 입력값이 없으면 좁게, 있으면 일반 열처럼 넓힙니다.
      if (isCheckbox && maxLen[col] <= colLabel(col).length) return CHECKBOX_COL_WIDTH;
      const estimated = maxLen[col] * CHAR_WIDTH_ESTIMATE + CELL_HORIZONTAL_PADDING;
      return Math.min(MAX_COL_WIDTH, Math.max(DEFAULT_COL_WIDTH, estimated));
    });
  }, [tab]);

  // colOffsets[i] = 0..i-1번 열 너비의 합 (i번 열이 시작하는 x좌표). 마지막 원소는 전체 너비.
  const colOffsets = useMemo(() => {
    const offsets = [0];
    colWidths.forEach((w) => offsets.push(offsets[offsets.length - 1] + w));
    return offsets;
  }, [colWidths]);

  // 로컬 DB라 로딩이 순식간이라, 첫 로드 전에는 별도 로딩 화면 없이 배경만 보여줍니다.
  if (loading && !tab) {
    return <View style={styles.container} />;
  }

  if (!tab) {
    return (
      <View style={styles.center}>
        <EmptyIllustration variant="grid" />
        <Text style={styles.emptyTitle}>아직 탭이 없어요</Text>
        <Text style={styles.emptyText}>오른쪽 위 ＋ 버튼으로 새 탭을 만들어보세요 ✨</Text>
        <NamePromptModal
          visible={addTabModalVisible}
          title="새 탭 추가"
          placeholder="탭 이름"
          onClose={() => setAddTabModalVisible(false)}
          onConfirm={handleAddTab}
        />
      </View>
    );
  }

  const openCell = (row: number, col: number) => {
    const cell = cellMap.get(`${row}_${col}`);
    const info: CellInfo = cell ?? { row, col, value: '', computed: 0 };
    setSelected(info);
    setDraft(info.formula ? info.formula : info.value);
  };

  const saveCheckbox = async (value: string) => {
    if (!selected || savingCell) return;
    setSavingCell(true);
    try {
      await api.updateCell(tab.id, selected.row, selected.col, value);
      if (value) setBurst((b) => b + 1);
      setSelected(null);
      await loadTab();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    } finally {
      setSavingCell(false);
    }
  };


  const changeColumnFormat = async (format: ColumnFormat) => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnFormat(tab.id, formatPickerCol, format);
      loadTab();
    } catch (e) {
      Alert.alert('열 포맷 변경 실패', String(e));
    }
  };

  const adjustColumnWidth = async (delta: number) => {
    if (formatPickerCol === null) return;
    const current = colWidths[formatPickerCol] ?? MIN_COL_WIDTH;
    const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round(current + delta)));
    try {
      await api.setColumnWidth(tab.id, formatPickerCol, next);
      loadTab();
    } catch (e) {
      Alert.alert('열 너비 변경 실패', String(e));
    }
  };

  const resetColumnWidthAuto = async () => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnWidth(tab.id, formatPickerCol, null);
      loadTab();
    } catch (e) {
      Alert.alert('열 너비 초기화 실패', String(e));
    }
  };

  const resetColumnWidthDefault = async () => {
    if (formatPickerCol === null) return;
    try {
      await api.setColumnWidth(tab.id, formatPickerCol, DEFAULT_COL_WIDTH);
      loadTab();
    } catch (e) {
      Alert.alert('열 너비 초기화 실패', String(e));
    }
  };

  const openMergeModal = (row: number, col: number) => {
    const existing = tab.merges.find((m) => m.anchorRow === row && m.anchorCol === col);
    setMergeTarget({ row, col, rowSpan: existing?.rowSpan ?? 1, colSpan: existing?.colSpan ?? 1 });
  };

  const adjustMergeSpan = (axis: 'rowSpan' | 'colSpan', delta: number) => {
    if (!mergeTarget) return;
    const max = axis === 'rowSpan' ? tab.rows - mergeTarget.row : tab.cols - mergeTarget.col;
    setMergeTarget({ ...mergeTarget, [axis]: Math.min(max, Math.max(1, mergeTarget[axis] + delta)) });
  };

  const applyMerge = async () => {
    if (!mergeTarget) return;
    try {
      await api.setMerge(tab.id, mergeTarget.row, mergeTarget.col, mergeTarget.rowSpan, mergeTarget.colSpan);
      if (mergeTarget.rowSpan > 1 || mergeTarget.colSpan > 1) setBurst((b) => b + 1);
      setMergeTarget(null);
      loadTab();
    } catch (e) {
      Alert.alert('병합 실패', String(e));
    }
  };

  const unmerge = async () => {
    if (!mergeTarget) return;
    try {
      await api.setMerge(tab.id, mergeTarget.row, mergeTarget.col, 1, 1);
      setMergeTarget(null);
      loadTab();
    } catch (e) {
      Alert.alert('병합 해제 실패', String(e));
    }
  };

  const insertRowAt = async (index: number) => {
    if (resizing) return;
    setResizing(true);
    try {
      await api.insertRow(tab.id, index);
      await loadTab();
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
      await api.insertColumn(tab.id, index);
      await loadTab();
    } catch (e) {
      Alert.alert('열 추가 실패', String(e));
    } finally {
      setResizing(false);
    }
  };

  const deleteRowAt = async (index: number) => {
    if (resizing) return;
    setResizing(true);
    try {
      await api.deleteRow(tab.id, index);
      await loadTab();
      setSnackbar({ message: '행이 삭제되었습니다' });
    } catch (e) {
      Alert.alert('행 삭제 실패', String(e));
    } finally {
      setResizing(false);
    }
  };

  const deleteColumnAt = async (index: number) => {
    if (resizing) return;
    setResizing(true);
    try {
      await api.deleteColumn(tab.id, index);
      await loadTab();
      setSnackbar({ message: '열이 삭제되었습니다' });
    } catch (e) {
      Alert.alert('열 삭제 실패', String(e));
    } finally {
      setResizing(false);
    }
  };

  const handleUndoDelete = async () => {
    setSnackbar(null);
    try {
      await api.undoLastDelete(tab.id);
      await loadTab();
    } catch (e) {
      Alert.alert('실행취소 실패', String(e));
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

  const confirmDelete = () => {
    if (!insertPrompt) return;
    const { axis, index } = insertPrompt;
    setInsertPrompt(null);
    setDeleteConfirm({ axis, index });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { axis, index } = deleteConfirm;
    setDeleteConfirm(null);
    if (axis === 'row') deleteRowAt(index);
    else deleteColumnAt(index);
  };

  const saveCell = async () => {
    if (!selected || savingCell) return;
    const isFormula = draft.trim().startsWith('=');
    setSavingCell(true);
    try {
      await api.updateCell(
        tab.id,
        selected.row,
        selected.col,
        isFormula ? '' : draft,
        isFormula ? draft.trim() : undefined
      );
      if (draft.trim()) setBurst((b) => b + 1);
      setSelected(null);
      await loadTab();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    } finally {
      setSavingCell(false);
    }
  };

  const clearCell = async () => {
    if (!selected || savingCell) return;
    setSavingCell(true);
    try {
      await api.updateCell(tab.id, selected.row, selected.col, '');
      setSelected(null);
      await loadTab();
    } catch (e) {
      Alert.alert('지우기 실패', String(e));
    } finally {
      setSavingCell(false);
    }
  };

  const renderDataCell = (row: number, col: number) => {
    const plan = mergePlan[row][col];
    if (plan.kind === 'skip') return null;

    const cell = cellMap.get(`${row}_${col}`);
    const format = tab.columnFormats[col] ?? 'text';
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
      const isMark = rawValue === 'O' || rawValue === 'X';
      return (
        <TouchableOpacity
          key={`${row}_${col}`}
          style={[styles.cell, positionStyle]}
          activeOpacity={0.6}
          onPress={() => openCell(row, col)}
          onLongPress={() => openMergeModal(row, col)}
        >
          {isMark ? (
            <Animated.View key={rawValue} entering={reduceMotion ? undefined : ZoomIn.springify().damping(9)}>
              <Ionicons
                name={rawValue === 'O' ? 'checkmark-circle' : 'close-circle'}
                size={30}
                color={rawValue === 'O' ? colors.primary : colors.danger}
              />
            </Animated.View>
          ) : rawValue !== '' ? (
            <Text numberOfLines={1} style={styles.cellText}>
              {rawValue}
            </Text>
          ) : null}
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
          {siblings.map((s) => (
            <TabPill key={s.id} name={s.name} active={s.id === tab.id} onPress={() => switchTab(s)} />
          ))}
        </ScrollView>
      )}
      <View style={styles.gridArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.row}>
              <View style={[styles.cell, styles.headerCell, styles.rowHeaderCell]} />
              {Array.from({ length: tab.cols }).map((_, col) => {
                const format = tab.columnFormats[col] ?? 'text';
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
                  {Array.from({ length: tab.rows }).map((_, row) => (
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
                <View style={{ width: colOffsets[tab.cols], height: tab.rows * CELL_HEIGHT }}>
                  {Array.from({ length: tab.rows }).flatMap((_, row) =>
                    Array.from({ length: tab.cols }).map((_, col) => renderDataCell(row, col))
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => !savingCell && setSelected(null)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>
                  {selected ? `${colLabel(selected.col)}${selected.row + 1}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8} disabled={savingCell}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {(() => {
              const isCheckboxCol = !!selected && tab.columnFormats[selected.col] === 'checkbox';
              const isNumberCol = !!selected && tab.columnFormats[selected.col] === 'number';
              const isFormulaDraft = draft.trim().startsWith('=');
              return (
                <>
                  <TextInput
                    style={styles.modalInput}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    multiline
                    textAlignVertical="top"
                    editable={!savingCell}
                    keyboardType={
                      isNumberCol && !isFormulaDraft ? 'numbers-and-punctuation' : 'default'
                    }
                  />

                  {isNumberCol && !isFormulaDraft && (
                    <View style={styles.unitRow}>
                      {['00', '000'].map((z) => (
                        <TouchableOpacity
                          key={z}
                          style={styles.unitButton}
                          onPress={() => setDraft((d) => (d.trim() ? d + z : d))}
                          disabled={savingCell}
                        >
                          <Text style={styles.unitButtonText}>{z}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {isCheckboxCol && (
                    <View style={styles.checkboxChoiceRow}>
                      <TouchableOpacity
                        style={[
                          styles.checkboxChoiceButton,
                          draft === 'O' && styles.checkboxChoiceButtonActive,
                          savingCell && styles.modalButtonDisabled,
                        ]}
                        onPress={() => saveCheckbox('O')}
                        disabled={savingCell}
                      >
                        <Ionicons name="checkmark-circle" size={26} color={draft === 'O' ? colors.white : colors.primary} />
                        <Text style={[styles.checkboxChoiceLabel, draft === 'O' && styles.checkboxChoiceLabelActive]}>O</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.checkboxChoiceButton,
                          draft === 'X' && styles.checkboxChoiceButtonActiveDanger,
                          savingCell && styles.modalButtonDisabled,
                        ]}
                        onPress={() => saveCheckbox('X')}
                        disabled={savingCell}
                      >
                        <Ionicons name="close-circle" size={26} color={draft === 'X' ? colors.white : colors.danger} />
                        <Text style={[styles.checkboxChoiceLabel, draft === 'X' && styles.checkboxChoiceLabelActive]}>X</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    {(selected?.value !== '' || !!selected?.formula) && (
                      <TouchableOpacity
                        onPress={clearCell}
                        style={[styles.modalButton, styles.modalCancel]}
                        disabled={savingCell}
                      >
                        <Text style={styles.modalDangerText}>비우기</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setSelected(null)}
                      style={[styles.modalButton, styles.modalCancel]}
                      disabled={savingCell}
                    >
                      <Text style={styles.modalCancelText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveCell}
                      style={[styles.modalButton, styles.modalPrimary, savingCell && styles.modalButtonDisabled]}
                      disabled={savingCell}
                    >
                      {savingCell ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.modalPrimaryText}>저장</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
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
              const active = formatPickerCol !== null && (tab.columnFormats[formatPickerCol] ?? 'text') === opt.format;
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

            <TouchableOpacity style={styles.formatOption} onPress={() => confirmInsert('after')}>
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

            {insertPrompt && (insertPrompt.axis === 'row' ? tab.rows : tab.cols) > 1 && (
              <TouchableOpacity
                style={[styles.formatOption, styles.formatOptionLast]}
                onPress={confirmDelete}
              >
                <View style={[styles.formatOptionIconWrap, styles.formatOptionIconWrapDanger]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </View>
                <View style={styles.formatOptionTextWrap}>
                  <Text style={[styles.formatOptionLabel, styles.formatOptionLabelDanger]}>
                    {insertPrompt.axis === 'row' ? '이 행 삭제' : '이 열 삭제'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.formatPickerTitle}>{deleteConfirm?.axis === 'row' ? '행 삭제' : '열 삭제'}</Text>
              <TouchableOpacity onPress={() => setDeleteConfirm(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalWarning}>
              {deleteConfirm?.axis === 'row'
                ? `${deleteConfirm.index + 1}행을 삭제할까요?`
                : deleteConfirm
                  ? `${colLabel(deleteConfirm.index)}열을 삭제할까요?`
                  : ''}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setDeleteConfirm(null)} style={[styles.modalButton, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={executeDelete} style={[styles.modalButton, styles.modalDanger]}>
                <Text style={styles.modalPrimaryText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NamePromptModal
        visible={addTabModalVisible}
        title="새 탭 추가"
        placeholder="탭 이름"
        onClose={() => setAddTabModalVisible(false)}
        onConfirm={handleAddTab}
      />

      <Snackbar
        visible={!!snackbar}
        message={snackbar?.message ?? ''}
        actionLabel="되돌리기"
        onAction={handleUndoDelete}
        onDismiss={() => setSnackbar(null)}
      />

      <HeartBurst trigger={burst} originY={0.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.medium },
  emptyTitle: { ...type.title, marginTop: spacing.sm },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.medium },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.xs },
  tabBar: { flexGrow: 0, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.sm,
  },
  tabPillActive: { backgroundColor: colors.primary },
  tabPillText: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: -0.1, color: colors.textSecondary },
  tabPillTextActive: { color: colors.white },
  gridArea: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  cellFormula: { backgroundColor: colors.accentSoft },
  headerCell: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
  rowHeaderCell: { width: ROW_HEADER_WIDTH },
  headerText: { fontFamily: fonts.bold, color: colors.textSecondary, fontSize: 13 },
  headerFormatIcon: { marginTop: 2 },
  cellText: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.regular },
  cellTextFormula: { color: colors.accentDark, fontFamily: fonts.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
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
  modalBadgeText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 13 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 44,
    maxHeight: 160,
    fontFamily: fonts.medium,
  },
  modalHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.md, fontFamily: fonts.regular },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg },
  modalButton: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill, marginLeft: spacing.sm },
  modalCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  modalDangerText: { color: colors.danger, fontFamily: fonts.semibold },
  modalPrimary: { backgroundColor: colors.primary },
  modalPrimaryText: { color: colors.white, fontFamily: fonts.bold },
  modalDanger: { backgroundColor: colors.danger },
  modalWarning: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontFamily: fonts.regular },
  modalButtonDisabled: { opacity: 0.5 },
  unitRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  unitButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: 'center',
  },
  unitButtonText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 13 },
  checkboxChoiceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  checkboxChoiceButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  checkboxChoiceButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxChoiceButtonActiveDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  checkboxChoiceButtonActiveMuted: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
  checkboxChoiceLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  checkboxChoiceLabelActive: { color: colors.white },
  formatPickerTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formatOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  formatOptionLast: { marginBottom: 0 },
  formatOptionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  formatOptionIconWrapDanger: { backgroundColor: colors.dangerSoft },
  formatOptionTextWrap: { flex: 1 },
  formatOptionLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  formatOptionLabelDanger: { color: colors.danger },
  formatOptionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.regular },
  widthSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm },
  widthLinkRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xs },
  autoFitLink: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepperLabel: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium },
  stepperControl: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { minWidth: 24, textAlign: 'center', fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
});
