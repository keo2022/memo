import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EventItem } from '../types';
import { colors, radius, spacing, shadow, fonts } from '../theme';
import { ddayLabel, formatKoreanDate, formatKoreanTime } from '../lib/date';

interface Props {
  visible: boolean;
  events: EventItem[];
  onClose: () => void;
  onSelect: (event: EventItem) => void;
}

export default function PastEventsModal({ visible, events, onClose, onSelect }: Props) {
  // 가장 최근에 지난 일이 위로 오도록 날짜 내림차순.
  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [events]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>지난 일정</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {sorted.length === 0 ? (
            <Text style={styles.empty}>지난 일정이 없어요</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {sorted.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => onSelect(e)}
                >
                  <View style={styles.ddayWrap}>
                    <Text style={styles.dday}>{ddayLabel(e.date)}</Text>
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.rowDate} numberOfLines={1}>
                      {formatKoreanDate(e.date)}
                      {e.time ? ` · ${formatKoreanTime(e.time)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ddayWrap: {
    minWidth: 52,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  dday: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.textSecondary },
  textWrap: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  rowDate: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
});
