import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';
import RingMascot, { MascotMood } from '../mascot/RingMascot';
import { colors } from '../../theme';

type Variant = 'sheets' | 'tabs' | 'grid';

const MOOD: Record<Variant, MascotMood> = { sheets: 'happy', tabs: 'excited', grid: 'wink' };

interface Props {
  variant: Variant;
  size?: number;
}

/** 빈 화면용 일러스트 — 뒤에 SVG 소품, 앞에 반지 마스코트. */
export default function EmptyIllustration({ variant, size = 150 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 150 150" style={StyleSheet.absoluteFill}>
        {/* 뒤 배경 원 */}
        <Circle cx={75} cy={78} r={54} fill={colors.primarySoft} />

        {variant === 'sheets' && (
          <G>
            <Rect x={40} y={54} width={54} height={68} rx={10} fill={colors.white} stroke={colors.primarySoftBorder} strokeWidth={2} transform="rotate(-8 67 88)" />
            <Rect x={56} y={50} width={54} height={68} rx={10} fill={colors.white} stroke={colors.primarySoftBorder} strokeWidth={2} transform="rotate(6 83 84)" />
            <Line x1={66} y1={70} x2={96} y2={70} stroke={colors.border} strokeWidth={3} strokeLinecap="round" />
            <Line x1={66} y1={82} x2={90} y2={82} stroke={colors.border} strokeWidth={3} strokeLinecap="round" />
          </G>
        )}

        {variant === 'tabs' && (
          <G>
            <Rect x={38} y={52} width={74} height={60} rx={12} fill={colors.white} stroke={colors.primarySoftBorder} strokeWidth={2} />
            <Line x1={38} y1={72} x2={112} y2={72} stroke={colors.border} strokeWidth={2} />
            <Line x1={38} y1={92} x2={112} y2={92} stroke={colors.border} strokeWidth={2} />
            <Line x1={63} y1={52} x2={63} y2={112} stroke={colors.border} strokeWidth={2} />
            <Line x1={88} y1={52} x2={88} y2={112} stroke={colors.border} strokeWidth={2} />
            <Rect x={38} y={44} width={26} height={14} rx={6} fill={colors.accentSoft} stroke={colors.accent} strokeWidth={2} />
          </G>
        )}

        {variant === 'grid' && (
          <G>
            <Rect x={44} y={56} width={62} height={62} rx={12} fill={colors.white} stroke={colors.primarySoftBorder} strokeWidth={2} />
            <Line x1={44} y1={77} x2={106} y2={77} stroke={colors.border} strokeWidth={2} />
            <Line x1={44} y1={98} x2={106} y2={98} stroke={colors.border} strokeWidth={2} />
            <Line x1={65} y1={56} x2={65} y2={118} stroke={colors.border} strokeWidth={2} />
            <Line x1={86} y1={56} x2={86} y2={118} stroke={colors.border} strokeWidth={2} />
            <Path d="M96 44 l14 14 -22 22 -14 -14 z" fill={colors.sparkle} stroke={colors.gold} strokeWidth={2} strokeLinejoin="round" />
          </G>
        )}
      </Svg>

      <View style={styles.mascot}>
        <RingMascot size={size * 0.5} mood={MOOD[variant]} animated />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  mascot: { position: 'absolute', bottom: 2, right: 6 },
});
