import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressSquish } from '../hooks/usePressSquish';

interface Props extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

/** 누르면 말랑 눌리는 Pressable. style은 안쪽 Animated.View에 적용된다. */
export default function Squishy({ children, style, scaleTo, onPressIn, onPressOut, ...rest }: Props) {
  const { handlers, style: squishStyle } = usePressSquish(scaleTo);
  return (
    <Pressable
      onPressIn={(e) => {
        handlers.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        handlers.onPressOut();
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, squishStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
