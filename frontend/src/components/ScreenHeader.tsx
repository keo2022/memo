import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow, type } from '../theme';
import RingMascot from './mascot/RingMascot';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** 기본 true — 우측에 작은 반지 마스코트. right를 주면 무시됨. */
  mascot?: boolean;
}

export default function ScreenHeader({ title, subtitle, onBack, right, mascot = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <View style={styles.titleRow}>
        <View style={styles.titleTextWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ?? (mascot ? <RingMascot size={46} mood="wink" animated /> : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleTextWrap: { flex: 1 },
  title: type.display,
  subtitle: { ...type.label, color: colors.textSecondary, marginTop: 4 },
});
