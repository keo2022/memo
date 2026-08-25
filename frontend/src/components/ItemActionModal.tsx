import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../theme';

type Mode = 'menu' | 'rename' | 'confirmDelete';

interface Props {
  visible: boolean;
  itemName: string;
  itemTypeLabel: string;
  deleteWarning: string;
  onClose: () => void;
  onRename: (newName: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

export default function ItemActionModal({
  visible,
  itemName,
  itemTypeLabel,
  deleteWarning,
  onClose,
  onRename,
  onDelete,
}: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [nameDraft, setNameDraft] = useState(itemName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode('menu');
      setNameDraft(itemName);
      setBusy(false);
    }
  }, [visible, itemName]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onRename(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {mode === 'menu' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>
                  {itemName}
                </Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.option} onPress={() => setMode('rename')}>
                <View style={styles.optionIconWrap}>
                  <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
                </View>
                <Text style={styles.optionLabel}>이름 변경</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.option, styles.optionLast]} onPress={() => setMode('confirmDelete')}>
                <View style={[styles.optionIconWrap, styles.optionIconWrapDanger]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </View>
                <Text style={[styles.optionLabel, styles.optionLabelDanger]}>삭제</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'rename' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>이름 변경</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholderTextColor={colors.textMuted}
                autoFocus
                onSubmitEditing={handleRename}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={() => setMode('menu')}
                  disabled={busy}
                >
                  <Text style={styles.buttonCancelText}>뒤로</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary, !nameDraft.trim() && styles.buttonDisabled]}
                  onPress={handleRename}
                  disabled={busy || !nameDraft.trim()}
                >
                  <Text style={styles.buttonPrimaryText}>저장</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'confirmDelete' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{itemTypeLabel} 삭제</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.warning}>{deleteWarning}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={() => setMode('menu')}
                  disabled={busy}
                >
                  <Text style={styles.buttonCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleDelete} disabled={busy}>
                  <Text style={styles.buttonPrimaryText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  optionLast: { marginBottom: 0 },
  optionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionIconWrapDanger: { backgroundColor: '#FCE7E7' },
  optionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  optionLabelDanger: { color: colors.danger },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  warning: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.sm, marginLeft: spacing.sm },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonCancelText: { color: colors.textSecondary, fontWeight: '600' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontWeight: '700' },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
});
