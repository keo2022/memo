import React, { useEffect, useState } from 'react';
import Svg, { Circle, Path, Ellipse, G, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export type MascotMood = 'happy' | 'sleepy' | 'excited' | 'wink';

interface Props {
  size?: number;
  mood?: MascotMood;
  animated?: boolean;
}

/** 얼굴 달린 결혼반지 마스코트. 반지 밴드가 얼굴을 감싸고, 위에 다이아가 얹혀 있다. */
export default function RingMascot({ size = 96, mood = 'happy', animated = false }: Props) {
  const reduceMotion = useReduceMotion();
  const active = animated && !reduceMotion;

  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!active) {
      bob.value = 0;
      tilt.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    if (mood === 'excited') {
      tilt.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 160 }),
          withTiming(1, { duration: 160 }),
          withDelay(1200, withTiming(0, { duration: 160 }))
        ),
        -1,
        false
      );
    }
    return () => {
      cancelAnimation(bob);
      cancelAnimation(tilt);
    };
  }, [active, mood, bob, tilt]);

  useEffect(() => {
    if (!active || mood === 'sleepy') return;
    const id = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 130);
    }, 3200);
    return () => clearInterval(id);
  }, [active, mood]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * 3 },
      { rotate: `${tilt.value * 5}deg` },
    ],
  }));

  const closedEyes = blinking || mood === 'sleepy';

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* 반짝이 */}
        <Sparkle x={12} y={26} r={3.2} />
        <Sparkle x={86} y={20} r={2.4} />
        <Sparkle x={82} y={74} r={2.8} />

        {/* 다이아 */}
        <G>
          <Path d="M50 6 L62 19 L50 35 L38 19 Z" fill={colors.sky} />
          <Path d="M50 6 L62 19 L50 19 Z" fill="#CBDDF0" />
          <Path d="M38 19 L62 19 L50 35 Z" fill="#9FBEE0" />
          <Line x1={44} y1={12.5} x2={40} y2={19} stroke={colors.white} strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
        </G>

        {/* 반지 밴드 */}
        <Circle cx={50} cy={60} r={30} stroke={colors.gold} strokeWidth={13} fill="none" />
        <Circle cx={50} cy={60} r={30} stroke="#F6D9B4" strokeWidth={4} fill="none" opacity={0.8} />

        {/* 얼굴 (밴드 안쪽 구멍) */}
        <G>
          {/* 볼터치 */}
          <Ellipse cx={39} cy={64} rx={4.5} ry={3} fill={colors.cheek} opacity={0.5} />
          <Ellipse cx={61} cy={64} rx={4.5} ry={3} fill={colors.cheek} opacity={0.5} />

          {/* 눈 */}
          {closedEyes ? (
            <>
              <Path d="M40 57 q3 3 6 0" stroke={colors.textPrimary} strokeWidth={2.4} fill="none" strokeLinecap="round" />
              {mood === 'wink' ? (
                <Ellipse cx={57} cy={56} rx={2.6} ry={3} fill={colors.textPrimary} />
              ) : (
                <Path d="M54 57 q3 3 6 0" stroke={colors.textPrimary} strokeWidth={2.4} fill="none" strokeLinecap="round" />
              )}
            </>
          ) : mood === 'wink' ? (
            <>
              <Ellipse cx={43} cy={56} rx={2.6} ry={3} fill={colors.textPrimary} />
              <Path d="M54 57 q3 3 6 0" stroke={colors.textPrimary} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Ellipse cx={43} cy={56} rx={2.8} ry={3.4} fill={colors.textPrimary} />
              <Ellipse cx={57} cy={56} rx={2.8} ry={3.4} fill={colors.textPrimary} />
            </>
          )}

          {/* 입 */}
          {mood === 'excited' ? (
            <Ellipse cx={50} cy={66} rx={3.6} ry={4.2} fill="#C2707F" />
          ) : mood === 'sleepy' ? (
            <Ellipse cx={50} cy={66} rx={2.4} ry={2.4} fill="#C2707F" opacity={0.8} />
          ) : (
            <Path d="M45 64 q5 5 10 0" stroke="#C2707F" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          )}
        </G>

        {mood === 'sleepy' && (
          <Path d="M74 30 h7 l-7 8 h7" stroke={colors.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </Svg>
    </Animated.View>
  );
}

function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <Path
      d={`M${x} ${y - r} L${x + r * 0.32} ${y - r * 0.32} L${x + r} ${y} L${x + r * 0.32} ${y + r * 0.32} L${x} ${y + r} L${x - r * 0.32} ${y + r * 0.32} L${x - r} ${y} L${x - r * 0.32} ${y - r * 0.32} Z`}
      fill={colors.sparkle}
    />
  );
}
