import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, fonts } from '../theme';

interface Props {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  /** value가 없을 때 피커를 열면 이 시각에서 시작합니다. */
  fallback: Date;
  displayText: string; // value가 있을 때 보여줄 텍스트
  placeholder?: string; // value가 없을 때 (시간처럼 선택 항목)
  clearable?: boolean;
  disabled?: boolean;
  onChange: (next: Date | null) => void;
}

export default function DateTimePickerField({
  label,
  mode,
  value,
  fallback,
  displayText,
  placeholder,
  clearable,
  disabled,
  onChange,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const base = value ?? fallback;

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode,
        is24Hour: false,
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(d);
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {clearable && value && !disabled && (
          <TouchableOpacity
            onPress={() => {
              onChange(null);
              setIosOpen(false);
            }}
            hitSlop={6}
          >
            <Text style={styles.clearLink}>지우기</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.field, iosOpen && styles.fieldOpen]}
        onPress={open}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={16}
          color={colors.primaryDark}
        />
        <Text style={[styles.value, !value && styles.valuePlaceholder]}>
          {value ? displayText : placeholder ?? '선택 안 함'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && iosOpen && (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={base}
            mode={mode}
            display="spinner"
            onChange={(_e, d) => {
              if (d) onChange(d);
            }}
            style={styles.iosPicker}
          />
          <TouchableOpacity style={styles.iosDone} onPress={() => setIosOpen(false)}>
            <Text style={styles.iosDoneText}>완료</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  label: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted },
  clearLink: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primarySoftBorder,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  fieldOpen: { borderColor: colors.primary },
  value: { flex: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  valuePlaceholder: { fontFamily: fonts.medium, color: colors.textMuted },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iosPicker: { alignSelf: 'stretch' },
  iosDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    marginRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  iosDoneText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 13 },
});
