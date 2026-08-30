import { useCallback } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { motion } from '../theme';
import { useReduceMotion } from './useReduceMotion';

/**
 * 누르면 말랑 눌리고, 떼면 통통 튀는 프레스 피드백.
 * 반환한 handlers를 Pressable(onPressIn/onPressOut)에, style을 Animated.View에 연결한다.
 */
export function usePressSquish(scaleTo = 0.93) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const onPressIn = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(scaleTo, motion.squish);
  }, [reduceMotion, scaleTo, scale]);

  const onPressOut = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, motion.bouncy);
  }, [reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { handlers: { onPressIn, onPressOut }, style };
}
