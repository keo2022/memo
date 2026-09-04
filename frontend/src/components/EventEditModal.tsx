import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import { parseYmd, toYmd } from '../lib/date';

interface Props {
  visible: boolean;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialDate?: string;
  onClose: () => void;
  onSubmit: (title: string, date: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

export default function EventEditModal({
  visible,
  mode,
  initialTitle,
  initialDate,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setTitle(initialTitle ?? '');
    const p = initialDate ? parseYmd(initialDate) : null;
    const base = p ?? nextYearGuess();
    setYear(String(base.y));
    setMonth(String(base.m));
    setDay(String(base.d));
  }, [visible, initialTitle, initialDate]);

  const submit = async () => {
    if (busy) return;
    const t = title.trim();
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!t) return Alert.alert('제목을 입력해주세요');
    if (!Number.isInteger(y) || y < 1900 || y > 2200) return Alert.alert('연도를 확인해주세요');
    if (!Number.isInteger(m) || m < 1 || m > 12) return Alert.alert('월을 확인해주세요');
    const maxDay = new Date(y, m, 0).getDate();
    if (!Number.isInteger(d) || d < 1 || d > maxDay) return Alert.alert(`일을 확인해주세요 (1~${maxDay})`);

    setBusy(true);
    try {
      await onSubmit(t, toYmd(y, m, d));
      onClose();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !onDelete) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      Alert.alert('삭제 실패', String(e));
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

          <Text style={styles.fieldLabel}>제목</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            editable={!busy}
            autoFocus={mode === 'create'}
          />

          <Text style={styles.fieldLabel}>날짜</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <TextInput
                style={styles.dateInput}
                value={year}
                onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                editable={!busy}
              />
              <Text style={styles.dateUnit}>년</Text>
            </View>
            <View style={styles.dateField}>
              <TextInput
                style={styles.dateInput}
                value={month}
                onChangeText={(v) => setMonth(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                editable={!busy}
              />
              <Text style={styles.dateUnit}>월</Text>
            </View>
            <View style={styles.dateField}>
              <TextInput
                style={styles.dateInput}
                value={day}
                onChangeText={(v) => setDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                editable={!busy}
              />
              <Text style={styles.dateUnit}>일</Text>
            </View>
          </View>

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

function nextYearGuess() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '88%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.floating },
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
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.primarySoftBorder,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.bold,
  },
  dateUnit: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill },
  buttonGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonDangerText: { color: colors.danger, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
});
