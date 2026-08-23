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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { CellInfo, SheetDetail } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetDetail'>;

const CELL_WIDTH = 90;
const ROW_HEADER_WIDTH = 40;
const CELL_HEIGHT = 44;

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

export default function SheetDetailScreen({ route }: Props) {
  const { sheetId } = route.params;
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [selected, setSelected] = useState<CellInfo | null>(null);
  const [draft, setDraft] = useState('');

  const loadSheet = useCallback(async () => {
    try {
      setSheet(await api.getSheet(sheetId));
    } catch (e) {
      Alert.alert('시트를 불러오지 못했습니다', String(e));
    }
  }, [sheetId]);

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

  const openCell = (row: number, col: number) => {
    const cell = cellMap.get(`${row}_${col}`);
    const info: CellInfo = cell ?? { row, col, value: '', computed: 0 };
    setSelected(info);
    setDraft(info.formula ? info.formula : info.value);
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
        <Text>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell, styles.rowHeaderCell]} />
            {Array.from({ length: sheet.cols }).map((_, col) => (
              <View key={col} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>{colLabel(col)}</Text>
              </View>
            ))}
          </View>
          <ScrollView>
            {Array.from({ length: sheet.rows }).map((_, row) => (
              <View key={row} style={styles.row}>
                <View style={[styles.cell, styles.headerCell, styles.rowHeaderCell]}>
                  <Text style={styles.headerText}>{row + 1}</Text>
                </View>
                {Array.from({ length: sheet.cols }).map((_, col) => {
                  const cell = cellMap.get(`${row}_${col}`);
                  const display = cell?.formula ? String(cell.computed) : cell?.value ?? '';
                  return (
                    <TouchableOpacity key={col} style={styles.cell} onPress={() => openCell(row, col)}>
                      <Text numberOfLines={1} style={styles.cellText}>
                        {display}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selected ? `${colLabel(selected.col)}${selected.row + 1}` : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="값 또는 =SUM(A1:A3) 같은 수식"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalButton}>
                <Text>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCell} style={[styles.modalButton, styles.modalPrimary]}>
                <Text style={styles.modalPrimaryText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderWidth: 0.5,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerCell: { backgroundColor: '#f3f4f6' },
  rowHeaderCell: { width: ROW_HEADER_WIDTH },
  headerText: { fontWeight: '600', color: '#555' },
  cellText: { fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8 },
  modalPrimary: { backgroundColor: '#2563eb', borderRadius: 8 },
  modalPrimaryText: { color: '#fff', fontWeight: '600' },
});
