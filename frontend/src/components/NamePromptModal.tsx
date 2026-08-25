import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void> | void;
}

export default function NamePromptModal({ visible, title, placeholder, confirmLabel = '추가', onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setBusy(false);
    }
  }, [visible]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoFocus
            onSubmitEditing={handleConfirm}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={handleClose} disabled={busy}>
              <Text style={styles.buttonCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, !name.trim() && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={busy || !name.trim()}
            >
              <Text style={styles.buttonPrimaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,33,23,0.45)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.floating,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.sm, marginLeft: spacing.sm },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonCancelText: { color: colors.textSecondary, fontWeight: '600' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
});
