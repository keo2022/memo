import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import type { EventItem, EventLink, MemoSummary, Sheet } from '../types';

interface Props {
  visible: boolean;
  event: EventItem | null;
  memos: MemoSummary[];
  sheets: Sheet[];
  onClose: () => void;
  onSave: (links: EventLink[]) => Promise<void> | void;
}

export default function EventLinkModal({ visible, event, memos, sheets, onClose, onSave }: Props) {
  const [memoIds, setMemoIds] = useState<string[]>([]);
  const [sheetIds, setSheetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !event) return;
    setBusy(false);
    const links = event.links ?? [];
    setMemoIds(links.filter((l) => l.kind === 'memo').map((l) => l.refId));
    setSheetIds(links.filter((l) => l.kind === 'sheet').map((l) => l.refId));
  }, [visible, event]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const links: EventLink[] = [
        ...memoIds.map((refId) => ({ kind: 'memo' as const, refId })),
        ...sheetIds.map((refId) => ({ kind: 'sheet' as const, refId })),
      ];
      await onSave(links);
      onClose();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  const count = memoIds.length + sheetIds.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {event?.title ?? ''}
              </Text>
              <Text style={styles.subtitle}>메모·엑셀 연결</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} disabled={busy}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            <Text style={styles.sectionLabel}>메모</Text>
            {memos.length === 0 ? (
              <Text style={styles.emptyLine}>아직 메모가 없어요</Text>
            ) : (
              memos.map((m) => {
                const on = memoIds.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.row, on && styles.rowOn]}
                    activeOpacity={0.7}
                    onPress={() => toggle(memoIds, setMemoIds, m.id)}
                  >
                    <Ionicons name="document-text" size={16} color={colors.primaryDark} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={on ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>엑셀 시트</Text>
            {sheets.length === 0 ? (
              <Text style={styles.emptyLine}>아직 시트가 없어요</Text>
            ) : (
              sheets.map((s) => {
                const on = sheetIds.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.row, on && styles.rowOn]}
                    activeOpacity={0.7}
                    onPress={() => toggle(sheetIds, setSheetIds, s.id)}
                  >
                    <Ionicons name="grid" size={16} color={colors.primaryDark} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={on ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.buttonGhost]} disabled={busy}>
              <Text style={styles.buttonGhostText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={[styles.button, styles.buttonPrimary]} disabled={busy}>
              <Text style={styles.buttonPrimaryText}>{count > 0 ? `저장 (${count})` : '저장'}</Text>
            </TouchableOpacity>
          </View>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  title: { ...type.title, fontSize: 19 },
  subtitle: { ...type.caption, marginTop: 2 },
  body: { flexGrow: 0 },
  sectionLabel: { ...type.label, marginBottom: spacing.sm },
  emptyLine: { ...type.caption, fontSize: 13, paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  rowOn: { borderColor: colors.primarySoftBorder, backgroundColor: colors.primarySoft },
  rowText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.sm },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill },
  buttonGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
});
