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
import { loadEditorName, saveEditorName } from '../lib/identity';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 별명이 바뀌면 알려줍니다 (헤더 등에서 다시 그릴 수 있게). */
  onNameChange?: (name: string) => void;
}

// 2명만 쓰는 앱이라 자주 열 화면은 아니고, 메인 화면의 톱니 아이콘으로만 들어옵니다.
export default function SettingsModal({ visible, onClose, onNameChange }: Props) {
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    loadEditorName().then((n) => {
      setName(n ?? '');
      setSavedName(n ?? '');
    });
  }, [visible]);

  const trimmed = name.trim();
  const dirty = trimmed !== savedName.trim();

  const submit = async () => {
    if (busy || !trimmed || !dirty) return;
    setBusy(true);
    try {
      await saveEditorName(trimmed);
      setSavedName(trimmed);
      onNameChange?.(trimmed);
      onClose();
    } catch (e) {
      Alert.alert('저장 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>설정</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} disabled={busy}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>내 별명</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            editable={!busy}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Text style={styles.hint}>메모·엑셀 편집 기록에 이 별명으로 표시돼요.</Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.buttonGhost]} disabled={busy}>
              <Text style={styles.buttonGhostText}>닫기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              style={[styles.button, styles.buttonPrimary, (!trimmed || !dirty) && styles.buttonDisabled]}
              disabled={busy || !trimmed || !dirty}
            >
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
  hint: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 8, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.sm },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill },
  buttonGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
  buttonDisabled: { opacity: 0.5 },
});
