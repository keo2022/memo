import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';

const EMOJIS = ['💕', '✨', '🤍', '💍', '🎀'];

interface Props {
  /** 버스트를 다시 재생하려면 이 값을 증가시킨다. 0/undefined면 재생 안 함. */
  trigger: number;
  onDone?: () => void;
  originY?: number; // 컨테이너 세로 기준 비율(0~1), 기본 중앙
}

/** 하트·반짝이가 한 번 방사되고 사라지는 축하 이펙트. */
export default function HeartBurst({ trigger, onDone, originY = 0.5 }: Props) {
  const reduceMotion = useReduceMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: 11 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 11 + Math.random() * 0.5;
        const dist = 70 + Math.random() * 60;
        return {
          id: `${trigger}-${i}`,
          emoji: EMOJIS[i % EMOJIS.length],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 30,
          rot: (Math.random() - 0.5) * 90,
          delay: Math.random() * 70,
          size: 16 + Math.random() * 12,
        };
      }),
    [trigger]
  );

  if (!trigger || reduceMotion) return null;

  return (
    <Animated.View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.origin, { top: `${originY * 100}%` }]}>
        {particles.map((p, idx) => {
          const { id, ...rest } = p;
          return <Particle key={id} {...rest} onDone={idx === 0 ? onDone : undefined} />;
        })}
      </Animated.View>
    </Animated.View>
  );
}

function Particle({
  emoji,
  dx,
  dy,
  rot,
  delay,
  size,
  onDone,
}: {
  emoji: string;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  size: number;
  onDone?: () => void;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      })
    );
  }, [p, delay, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value },
      { scale: 0.4 + p.value * 0.9 },
      { rotate: `${rot * p.value}deg` },
    ],
  }));

  return <Animated.Text style={[{ position: 'absolute', fontSize: size }, style]}>{emoji}</Animated.Text>;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  origin: { position: 'absolute', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
});
