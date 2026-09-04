import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn } from 'react-native-reanimated';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import PeaMascot, { MascotMood } from './mascot/PeaMascot';
import Squishy from './Squishy';
import { useReduceMotion } from '../hooks/useReduceMotion';

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

const MOOD: Record<Mode, MascotMood> = { menu: 'happy', rename: 'excited', confirmDelete: 'sleepy' };

export default function ItemActionModal({
  visible,
  itemName,
  itemTypeLabel,
  deleteWarning,
  onClose,
  onRename,
  onDelete,
}: Props) {
  const reduceMotion = useReduceMotion();
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
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View key={mode} entering={reduceMotion ? undefined : BounceIn} style={styles.card}>
          <View style={styles.mascotWrap}>
            <PeaMascot size={62} mood={MOOD[mode]} animated />
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          {mode === 'menu' && (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {itemName}
              </Text>
              <Squishy style={styles.option} onPress={() => setMode('rename')}>
                <View style={styles.optionIconWrap}>
                  <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
                </View>
                <Text style={styles.optionLabel}>이름 바꾸기</Text>
              </Squishy>
              <Squishy style={[styles.option, styles.optionLast]} onPress={() => setMode('confirmDelete')}>
                <View style={[styles.optionIconWrap, styles.optionIconWrapDanger]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </View>
                <Text style={[styles.optionLabel, styles.optionLabelDanger]}>삭제하기</Text>
              </Squishy>
            </>
          )}

          {mode === 'rename' && (
            <>
              <Text style={styles.title}>새 이름은?</Text>
              <TextInput
                style={styles.input}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholderTextColor={colors.textMuted}
                autoFocus
                onSubmitEditing={handleRename}
              />
              <View style={styles.actions}>
                <Squishy style={[styles.button, styles.buttonCancel]} onPress={() => setMode('menu')} disabled={busy}>
                  <Text style={styles.buttonCancelText}>뒤로</Text>
                </Squishy>
                <Squishy
                  style={[styles.button, styles.buttonPrimary, !nameDraft.trim() && styles.buttonDisabled]}
                  onPress={handleRename}
                  disabled={busy || !nameDraft.trim()}
                >
                  <Text style={styles.buttonPrimaryText}>저장</Text>
                </Squishy>
              </View>
            </>
          )}

          {mode === 'confirmDelete' && (
            <>
              <Text style={styles.title}>{itemTypeLabel}, 삭제할까요?</Text>
              <Text style={styles.warning}>{deleteWarning}</Text>
              <View style={styles.actions}>
                <Squishy style={[styles.button, styles.buttonCancel]} onPress={() => setMode('menu')} disabled={busy}>
                  <Text style={styles.buttonCancelText}>아니요</Text>
                </Squishy>
                <Squishy style={[styles.button, styles.buttonDanger]} onPress={handleDelete} disabled={busy}>
                  <Text style={styles.buttonPrimaryText}>삭제</Text>
                </Squishy>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: 24,
    ...shadow.floating,
  },
  mascotWrap: { position: 'absolute', top: -30, alignSelf: 'center' },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, padding: 2 },
  title: { ...type.title, fontSize: 20, textAlign: 'center', marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  optionLast: { marginBottom: 0 },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionIconWrapDanger: { backgroundColor: colors.dangerSoft },
  optionLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  optionLabelDanger: { color: colors.danger },
  input: {
    borderWidth: 1.5,
    borderColor: colors.primarySoftBorder,
    borderRadius: radius.md,
    padding: 13,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontFamily: fonts.medium,
  },
  warning: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.sm },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonCancelText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary, ...shadow.glow },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
  buttonDanger: { backgroundColor: colors.danger, ...shadow.glow },
  buttonDisabled: { opacity: 0.5 },
});
