import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn } from 'react-native-reanimated';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import PeaMascot from './mascot/PeaMascot';
import Squishy from './Squishy';
import { useReduceMotion } from '../hooks/useReduceMotion';

interface Props {
  visible: boolean;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void> | void;
}

export default function NamePromptModal({ visible, title, placeholder, confirmLabel = '추가', onClose, onConfirm }: Props) {
  const reduceMotion = useReduceMotion();
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
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          key={visible ? 'open' : 'closed'}
          entering={reduceMotion ? undefined : BounceIn}
          style={styles.card}
        >
          <View style={styles.mascotWrap}>
            <PeaMascot size={62} mood="excited" animated />
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

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
            <Squishy style={[styles.button, styles.buttonCancel]} onPress={handleClose} disabled={busy}>
              <Text style={styles.buttonCancelText}>취소</Text>
            </Squishy>
            <Squishy
              style={[styles.button, styles.buttonPrimary, !name.trim() && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={busy || !name.trim()}
            >
              <Text style={styles.buttonPrimaryText}>{confirmLabel}</Text>
            </Squishy>
          </View>
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.sm },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonCancelText: { color: colors.textSecondary, fontFamily: fonts.semibold },
  buttonPrimary: { backgroundColor: colors.primary, ...shadow.glow },
  buttonPrimaryText: { color: colors.white, fontFamily: fonts.bold },
  buttonDisabled: { opacity: 0.5 },
});
