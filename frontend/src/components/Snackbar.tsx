import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadow } from '../theme';

interface Props {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 5000,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  message: { flex: 1, color: colors.white, fontSize: 14, marginRight: spacing.md },
  action: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
