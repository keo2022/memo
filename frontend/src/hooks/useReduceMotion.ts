import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** OS "동작 줄이기" 설정을 구독한다. true면 딜라이트 애니를 페이드/즉시로 낮춘다. */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
