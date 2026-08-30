import React, { useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadow, fonts } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

interface Props {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function Snackbar({ visible, message, actionLabel, onAction, onDismiss, duration = 5000 }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.wrap, { bottom: insets.bottom + spacing.lg }]}
      pointerEvents="box-none"
      entering={reduceMotion ? undefined : FadeInDown.springify().damping(14).stiffness(180)}
      exiting={reduceMotion ? undefined : FadeOutDown.duration(200)}
    >
      <Animated.View style={styles.bar}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  message: { flex: 1, color: colors.white, fontSize: 14, marginRight: spacing.md, fontFamily: fonts.medium },
  action: { color: '#F0B8C1', fontFamily: fonts.extrabold, fontSize: 14 },
});
