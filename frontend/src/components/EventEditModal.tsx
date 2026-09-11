import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import { parseYmd, toYmd, formatKoreanDate, formatKoreanTime } from '../lib/date';
import { friendlyMessage } from '../lib/errors';
import DateTimePickerField from './DateTimePickerField';

export interface EventFormValue {
  title: string;
  date: string;
  pinned: boolean;
  time: string | null; // 'HH:MM' 또는 null
  location: string | null;
  note: string | null;
}

interface Props {
  visible: boolean;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialDate?: string;
  initialPinned?: boolean;
  initialTime?: string;
  initialLocation?: string;
  initialNote?: string;
  onClose: () => void;
  onSubmit: (value: EventFormValue) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function timeToDate(hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function noonToday(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function EventEditModal({
  visible,
  mode,
  initialTitle,
  initialDate,
  initialPinned,
  initialTime,
  initialLocation,
  initialNote,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState('');
  const [dateValue, setDateValue] = useState<Date>(() => new Date());
  const [timeValue, setTimeValue] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setTitle(initialTitle ?? '');
    setPinned(initialPinned ?? false);
    setLocation(initialLocation ?? '');
    setNote(initialNote ?? '');
    setTimeValue(initialTime ? timeToDate(initialTime) : null);
    const p = initialDate ? parseYmd(initialDate) : null;
    setDateValue(p ? new Date(p.y, p.m - 1, p.d) : new Date());
  }, [visible, initialTitle, initialDate, initialPinned, initialTime, initialLocation, initialNote]);

  const dateStr = toYmd(dateValue.getFullYear(), dateValue.getMonth() + 1, dateValue.getDate());
  const timeStr = timeValue ? `${pad2(timeValue.getHours())}:${pad2(timeValue.getMinutes())}` : null;

  const submit = async () => {
    if (busy) return;
    const t = title.trim();
    if (!t) return Alert.alert('제목을 입력해주세요');

    setBusy(true);
    try {
      await onSubmit({
        title: t,
        date: dateStr,
        pinned,
        time: timeStr,
        location: location.trim() || null,
        note: note.trim() || null,
      });
      onClose();
    } catch (e) {
      Alert.alert('저장 실패', friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (busy || !onDelete) return;
    Alert.alert('이 일정을 삭제할까요?', `"${title || '이 일정'}"이(가) 사라져요.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: confirmRemove },
    ]);
  };

  const confirmRemove = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      Alert.alert('삭제 실패', friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{mode === 'create' ? '날짜 추가' : '날짜 수정'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} disabled={busy}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >
            <Text style={styles.fieldLabel}>제목</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              editable={!busy}
              autoFocus={mode === 'create'}
            />

            <DateTimePickerField
              label="날짜"
              mode="date"
              value={dateValue}
              fallback={dateValue}
              displayText={formatKoreanDate(dateStr)}
              disabled={busy}
              onChange={(d) => d && setDateValue(d)}
            />

            <DateTimePickerField
              label="시간 (선택)"
              mode="time"
              value={timeValue}
              fallback={noonToday()}
              displayText={timeStr ? formatKoreanTime(timeStr) : ''}
              placeholder="하루 종일"
              clearable
              disabled={busy}
              onChange={setTimeValue}
            />

            <Text style={styles.fieldLabel}>장소 (선택)</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              editable={!busy}
              placeholder="예: ○○웨딩홀 3층"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />

            <Text style={styles.fieldLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              editable={!busy}
              placeholder="준비물, 드레스코드, 주차 안내 등"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />

            <TouchableOpacity
              style={styles.pinRow}
              onPress={() => setPinned((v) => !v)}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Ionicons
                name={pinned ? 'pin' : 'pin-outline'}
                size={18}
                color={pinned ? colors.primaryDark : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.pinTitle}>맨 위에 고정</Text>
                <Text style={styles.pinHint}>공지처럼 목록 제일 위에 계속 보여요</Text>
              </View>
              <View style={[styles.pinCheck, pinned && styles.pinCheckOn]}>
                {pinned && <Ionicons name="checkmark" size={15} color={colors.white} />}
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.actions}>
            {mode === 'edit' && onDelete && (
              <TouchableOpacity onPress={remove} style={[styles.button, styles.buttonGhost]} disabled={busy}>
                <Text style={styles.buttonDangerText}>삭제</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.buttonGhost]} disabled={busy}>
              <Text style={styles.buttonGhostText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.button, styles.buttonPrimary]} disabled={busy}>
              <Text style={styles.buttonPrimaryText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '88%',
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...type.title, fontSize: 19 },
  fieldLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.primarySoftBorder,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontFamily: fonts.medium,
  },
  scrollArea: { flexGrow: 0, flexShrink: 1 },
  noteInput: { minHeight: 72, maxHeight: 140 },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  pinHint: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  pinCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCheckOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill },
  buttonGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonDangerText: { color: colors.danger, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
});
