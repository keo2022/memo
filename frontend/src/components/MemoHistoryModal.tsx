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
import type { MemoHistoryEntry, Memo } from '../types';
import { colors, radius, spacing, shadow, fonts } from '../theme';
import { relativeTime } from '../lib/date';
import { friendlyMessage } from '../lib/errors';

interface Props {
  visible: boolean;
  memoId: string | null;
  onClose: () => void;
  onReverted: (memo: Memo) => void;
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine === '') return '(빈 내용)';
  return oneLine.length > 140 ? oneLine.slice(0, 140) + '…' : oneLine;
}

export default function MemoHistoryModal({ visible, memoId, onClose, onReverted }: Props) {
  const [entries, setEntries] = useState<MemoHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!memoId) return;
    setLoading(true);
    try {
      setEntries(await api.getMemoHistory(memoId, 50));
    } catch (e) {
      Alert.alert('기록을 불러오지 못했습니다', friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleRevert = async (entry: MemoHistoryEntry) => {
    if (!memoId || revertingId !== null) return;
    setRevertingId(entry.id);
    try {
      const memo = await api.revertMemoHistory(memoId, entry.id);
      onReverted(memo);
      await load();
    } catch (e) {
      Alert.alert('되돌릴 수 없어요', friendlyMessage(e));
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
            <>
              <Text style={styles.lead}>되돌리면 그 시점의 내용으로 바뀌고, 지금 내용도 기록에 남아요.</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {entries.map((entry, idx) => (
                  <View key={entry.id} style={styles.item}>
                    <View style={styles.itemTop}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {entry.editor ?? '알 수 없음'} · {relativeTime(entry.createdAt)}
                        {entry.kind === 'revert' ? ' · 되돌림' : ''}
                      </Text>
                      {idx === 0 && <Text style={styles.currentTag}>현재</Text>}
                    </View>
                    <Text style={styles.snippet} numberOfLines={3}>
                      {preview(entry.content)}
                    </Text>
                    {idx !== 0 && (
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
                            <Text style={styles.revertText}>이 내용으로 되돌리기</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  lead: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
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
  meta: { flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium },
  currentTag: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  snippet: { fontSize: 13, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 19 },
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
