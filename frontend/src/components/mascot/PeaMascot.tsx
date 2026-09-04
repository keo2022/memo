import React, { useEffect, useState } from 'react';
import Svg, { Circle, Path, Ellipse, G, Defs, ClipPath } from 'react-native-svg';
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
export type MascotHat = 'none' | 'cap';

interface Props {
  size?: number;
  mood?: MascotMood;
  animated?: boolean;
  /** 머리 위에 얹을 것. 기본 'cap' (꾸러기 프로펠러 모자). */
  hat?: MascotHat;
}

// 완두콩 색: 친근한 중간 초록 + 한 톤 짙은 그림자 + 밝은 하이라이트 (셀 셰이딩)
const BASE = '#84C64C';
const SHADE = '#5FA838';
const SHEEN = '#A9DE71';
const EYE = '#2E2E2E';

// 프로펠러 모자 (알록달록 패널)
const CAP_RED = '#E86A5A';
const CAP_YEL = '#F2C14E';
const CAP_BLU = '#5B8DD6';
const CAP_GRN = '#57AE57';
const CAP_GRN_DARK = '#489848';
const CAP_DARK = '#3B3B44';

const BODY_D = 'M50 22 C 70 22, 84 37, 84 56 C 84 75, 69 87, 50 87 C 31 87, 16 75, 16 56 C 16 37, 30 22, 50 22 Z';
const DOME_D = 'M32 27 Q32 13 50 13 Q68 13 68 27 Q50 24.5 32 27 Z';

/** 통통하게 둥근 완두콩 한 알 마스코트. 반짝이는 큰 눈, 볼터치, 짧은 팔다리에 머리 위 장식(hat). */
export default function PeaMascot({ size = 96, mood = 'happy', animated = false, hat = 'cap' }: Props) {
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
        withTiming(-1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    if (mood === 'excited') {
      tilt.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 150 }),
          withTiming(1, { duration: 150 }),
          withDelay(1100, withTiming(0, { duration: 150 }))
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
      setTimeout(() => setBlinking(false), 120);
    }, 3400);
    return () => clearInterval(id);
  }, [active, mood]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * 2.5 },
      { rotate: `${tilt.value * 5}deg` },
      // 둥실 뜰 때 살짝 눌렸다 펴지는 젤리 느낌
      { scaleX: 1 + bob.value * 0.03 },
      { scaleY: 1 - bob.value * 0.03 },
    ],
  }));

  const closedEyes = blinking || mood === 'sleepy';
  const bigEyes = mood === 'excited';

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="peaBody">
            <Path d={BODY_D} />
          </ClipPath>
          <ClipPath id="capDome">
            <Path d={DOME_D} />
          </ClipPath>
        </Defs>

        {/* 바닥 그림자 */}
        <Ellipse cx={50} cy={93} rx={23} ry={3.4} fill={SHADE} opacity={0.15} />

        {/* 팔·다리 (몸통 뒤에서 빼꼼) */}
        <G transform="rotate(18 15 62)">
          <Ellipse cx={15} cy={62} rx={5} ry={5.6} fill={SHADE} />
        </G>
        <G transform="rotate(-18 85 62)">
          <Ellipse cx={85} cy={62} rx={5} ry={5.6} fill={SHADE} />
        </G>
        <Ellipse cx={39} cy={86} rx={6.5} ry={4.8} fill={SHADE} />
        <Ellipse cx={61} cy={86} rx={6.5} ry={4.8} fill={SHADE} />

        {/* 몸통 + 셀 셰이딩 */}
        <Path d={BODY_D} fill={BASE} />
        <G clipPath="url(#peaBody)">
          <Ellipse cx={60} cy={78} rx={40} ry={30} fill={SHADE} opacity={0.55} />
          <Ellipse cx={37} cy={40} rx={22} ry={17} fill={SHEEN} opacity={0.55} />
        </G>

        {/* 머리 위 장식 */}
        {hat === 'cap' && <Cap />}

        {/* 강조 반짝임 (졸릴 땐 생략) */}
        {mood !== 'sleepy' && (
          <Path
            d="M77 27 l3.5 -3.5 M81 32 l4.5 -2.5"
            stroke={SHADE}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
        )}

        {/* 볼터치 */}
        <Ellipse cx={27.5} cy={61} rx={4.6} ry={3.1} fill={colors.cheek} opacity={bigEyes ? 0.85 : 0.7} />
        <Ellipse cx={72.5} cy={61} rx={4.6} ry={3.1} fill={colors.cheek} opacity={bigEyes ? 0.85 : 0.7} />

        {/* 눈 */}
        {closedEyes ? (
          <>
            <Path d="M35 54 q5 4 10 0" stroke={EYE} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <Path d="M55 54 q5 4 10 0" stroke={EYE} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          </>
        ) : mood === 'wink' ? (
          <>
            <Path d="M35 55 q5 -5 10 0" stroke={EYE} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <Eye cx={60} big={bigEyes} />
          </>
        ) : (
          <>
            <Eye cx={40} big={bigEyes} />
            <Eye cx={60} big={bigEyes} />
          </>
        )}

        {/* 입 */}
        {mood === 'excited' ? (
          <Path d="M44 60 Q50 68 56 60 Q50 63.5 44 60 Z" fill={EYE} />
        ) : mood === 'sleepy' ? (
          <Circle cx={50} cy={62} r={1.8} fill={EYE} opacity={0.75} />
        ) : mood === 'wink' ? (
          <Path d="M44.5 60 Q50 65.5 55.5 60" stroke={EYE} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ) : (
          <Path d="M45 60 Q50 64 55 60" stroke={EYE} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        )}

        {/* 졸음 표시 */}
        {mood === 'sleepy' && (
          <>
            <Circle cx={72} cy={30} r={1.5} fill={colors.textMuted} opacity={0.5} />
            <Circle cx={78} cy={24} r={2.2} fill={colors.textMuted} opacity={0.4} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}

/** 반짝이는 동그란 눈 한 쪽 (큰 캐치라이트 + 작은 점). */
function Eye({ cx, big }: { cx: number; big: boolean }) {
  const r = big ? 5.6 : 5.1;
  return (
    <>
      <Circle cx={cx} cy={53} r={r} fill={EYE} />
      <Circle cx={cx - 1.9} cy={50.7} r={2.1} fill={colors.white} />
      <Circle cx={cx + 1.9} cy={55.4} r={1} fill={colors.white} opacity={0.9} />
    </>
  );
}

/** 꾸러기 프로펠러 모자 — 머리에 딱 맞게, 기울이지 않고. body 위·얼굴 아래에 그려진다. */
function Cap() {
  return (
    <G>
      {/* 앞 챙 (돔 뒤) */}
      <Path d="M36 25 Q50 24 64 25 Q64.5 30 50 31.5 Q35.5 30 36 25 Z" fill={CAP_GRN} />
      <Path d="M37.5 29 Q50 31.3 62.5 29" stroke={CAP_GRN_DARK} strokeWidth={1.3} fill="none" opacity={0.7} />

      {/* 돔 + 알록달록 패널 */}
      <Path d={DOME_D} fill={CAP_GRN} />
      <G clipPath="url(#capDome)">
        <Path d="M50 13 L29 28 L40 28 Z" fill={CAP_RED} />
        <Path d="M50 13 L40 28 L50 28 Z" fill={CAP_YEL} />
        <Path d="M50 13 L50 28 L60 28 Z" fill={CAP_BLU} />
        <Path
          d="M50 13 L40 27 M50 13 L50 28 M50 13 L60 27"
          stroke="#00000018"
          strokeWidth={0.9}
        />
      </G>
      <Path d="M32 26.5 Q50 24 68 26.5" stroke={CAP_DARK} strokeWidth={1.3} fill="none" opacity={0.22} />

      {/* 꼭지 + 스탈크 + 구슬 */}
      <Circle cx={50} cy={13.2} r={2} fill={CAP_DARK} />
      <Path d="M50 12.5 L50 9" stroke={CAP_DARK} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={50} cy={11} r={1.2} fill={CAP_YEL} />
      <Circle cx={50} cy={9.1} r={1.2} fill={CAP_BLU} />

      {/* 프로펠러 — 통통하고 둥근 날개 2개 (안 돌아감) */}
      <G>
        <Ellipse cx={44.2} cy={8.6} rx={5.4} ry={2.9} fill={CAP_BLU} transform="rotate(-9 44.2 8.6)" />
        <Ellipse cx={55.8} cy={8.6} rx={5.4} ry={2.9} fill={CAP_RED} transform="rotate(9 55.8 8.6)" />
        <Circle cx={50} cy={8.4} r={1.9} fill={CAP_DARK} />
        <Circle cx={50} cy={7.9} r={0.7} fill={colors.white} opacity={0.6} />
      </G>
    </G>
  );
}
