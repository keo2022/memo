import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EventItem, EventLink } from '../types';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import { daysUntil, ddayLabel, formatKoreanDate, formatKoreanTime } from '../lib/date';

interface Props {
  visible: boolean;
  event: EventItem | null;
  linkLabel: (link: EventLink) => string | null;
  onOpenLink: (link: EventLink) => void;
  onClose: () => void;
  onEdit: () => void;
  onManageLinks: () => void;
}

export default function EventDetailModal({
  visible,
  event,
  linkLabel,
  onOpenLink,
  onClose,
  onEdit,
  onManageLinks,
}: Props) {
  const diff = event ? daysUntil(event.date) : 0;
  const links = (event?.links ?? [])
    .map((link) => ({ link, label: linkLabel(link) }))
    .filter((x): x is { link: EventLink; label: string } => x.label !== null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              {event?.pinned && <Ionicons name="pin" size={14} color={colors.primaryDark} />}
              <Text style={styles.title} numberOfLines={2}>
                {event?.title ?? ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            <Text style={styles.dday}>{event ? ddayLabel(event.date) : ''}</Text>
            <Text style={styles.ddayFoot}>
              {diff > 0 ? `${diff}일 남았어요` : diff === 0 ? '오늘이에요! 🎉' : `${-diff}일 지났어요`}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                {event ? formatKoreanDate(event.date) : ''}
                {event?.time ? ` · ${formatKoreanTime(event.time)}` : ''}
              </Text>
            </View>

            {!!event?.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoText}>{event.location}</Text>
              </View>
            )}

            {!!event?.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{event.note}</Text>
              </View>
            )}

            <View style={styles.linkSection}>
              <Text style={styles.linkLabel}>연결된 메모·엑셀</Text>
              {links.length === 0 ? (
                <Text style={styles.linkEmpty}>아직 없어요</Text>
              ) : (
                <View style={styles.chipRow}>
                  {links.map(({ link, label }) => (
                    <TouchableOpacity
                      key={link.kind + link.refId}
                      style={styles.chip}
                      activeOpacity={0.7}
                      onPress={() => onOpenLink(link)}
                    >
                      <Ionicons
                        name={link.kind === 'memo' ? 'document-text' : 'grid'}
                        size={12}
                        color={colors.primaryDark}
                      />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={onManageLinks}>
              <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.buttonGhostText}>연결</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={onEdit}>
              <Ionicons name="create-outline" size={16} color={colors.white} />
              <Text style={styles.buttonPrimaryText}>수정</Text>
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
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { ...type.title, fontSize: 20, flexShrink: 1 },
  dday: { fontSize: 44, fontFamily: fonts.display, color: colors.primaryDark, letterSpacing: 1, marginTop: spacing.sm },
  ddayFoot: { fontSize: 13, fontFamily: fonts.bold, color: colors.primaryDark, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  infoText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, flexShrink: 1 },
  noteBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: { fontSize: 14, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 21 },
  linkSection: { marginTop: spacing.lg },
  linkLabel: { ...type.label, marginBottom: spacing.sm },
  linkEmpty: { ...type.caption, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.primaryDark },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  buttonGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 14 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
});
