import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../db/repository';
import type { HistoryEntry } from '../types';
import { colors, radius, spacing, shadow, fonts } from '../theme';

interface Props {
  visible: boolean;
  tabId: string | null;
  onClose: () => void;
  onReverted: () => void;
}

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

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function describe(entry: HistoryEntry): { from: string; to: string } {
  const fmt = (v: string, f?: string) => (f ? f : v === '' ? '(빈칸)' : v);
  return {
    from: fmt(entry.prevValue, entry.prevFormula),
    to: fmt(entry.nextValue, entry.nextFormula),
  };
}

export default function HistoryModal({ visible, tabId, onClose, onReverted }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!tabId) return;
    setLoading(true);
    try {
      setEntries(await api.getHistory(tabId, 50));
    } catch (e) {
      Alert.alert('기록을 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
    }
  }, [tabId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleRevert = async (entry: HistoryEntry) => {
    if (!tabId || revertingId !== null) return;
    setRevertingId(entry.id);
    try {
      await api.revertHistory(tabId, entry.id);
      onReverted();
      await load();
    } catch (e) {
      Alert.alert('되돌릴 수 없어요', String(e).includes('409') ? '그 사이 다른 수정이 있었어요.' : String(e));
      await load();
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>변경 기록</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading && entries.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
          ) : entries.length === 0 ? (
            <Text style={styles.empty}>아직 변경 기록이 없어요</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {entries.map((entry, idx) => {
                const { from, to } = describe(entry);
                // 셀별 가장 최근 변경만 되돌릴 수 있습니다(그 뒤 수정이 있으면 서버가 거절).
                const revertable =
                  entries.findIndex((e) => e.row === entry.row && e.col === entry.col) === idx;
                return (
                  <View key={entry.id} style={styles.item}>
                    <View style={styles.itemTop}>
                      <View style={styles.cellBadge}>
                        <Text style={styles.cellBadgeText}>
                          {colLabel(entry.col)}
                          {entry.row + 1}
                        </Text>
                      </View>
                      <Text style={styles.meta} numberOfLines={1}>
                        {entry.editor ?? '알 수 없음'} · {relativeTime(entry.createdAt)}
                        {entry.kind === 'revert' ? ' · 되돌림' : ''}
                      </Text>
                    </View>
                    <View style={styles.changeRow}>
                      <Text style={styles.fromText} numberOfLines={1}>
                        {from}
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color={colors.textMuted} />
                      <Text style={styles.toText} numberOfLines={1}>
                        {to}
                      </Text>
                    </View>
                    {revertable && (
                      <TouchableOpacity
                        style={styles.revertButton}
                        onPress={() => handleRevert(entry)}
                        disabled={revertingId !== null}
                      >
                        {revertingId === entry.id ? (
                          <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : (
                          <>
                            <Ionicons name="arrow-undo" size={13} color={colors.primaryDark} />
                            <Text style={styles.revertText}>이 값으로 되돌리기</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '88%',
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.medium, paddingVertical: spacing.xl },
  list: { flexGrow: 0 },
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  cellBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cellBadgeText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 12 },
  meta: { flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fromText: { flexShrink: 1, color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, textDecorationLine: 'line-through' },
  toText: { flexShrink: 1, color: colors.textPrimary, fontSize: 13, fontFamily: fonts.bold },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  revertText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 12 },
});
