export const colors = {
  // 블러시 + 아이보리 (로맨틱)
  primary: '#D98C9A',
  primaryDark: '#C2707F',
  primarySoft: '#F8EAED',
  primarySoftBorder: '#EFD8DD',
  accent: '#B8A0C4',
  accentSoft: '#F1EAF4',
  accentDark: '#9A7FA8',
  background: '#FBF7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F6EEEB',
  border: '#EFE6E1',
  borderStrong: '#E4D8D2',
  textPrimary: '#3A2E30',
  textSecondary: '#8A7A78',
  textMuted: '#B7A9A6',
  danger: '#D2645C',
  dangerSoft: '#F7E3E1',
  white: '#FFFFFF',
  // 데코 포인트 (장식 전용, 텍스트 색으로는 쓰지 않음)
  sparkle: '#FFD98C',
  mint: '#A8DCC9',
  sky: '#AFC9E8',
  gold: '#E7B980',
  cheek: '#F4A9B0',
};

export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
  // 제목 전용 — 배민 주아체 (= Google Fonts "Jua")
  display: 'Jua',
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 26,
  xl: 34,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// 제목은 주아체(동글동글), 본문/UI는 Pretendard
export const type = {
  display: { fontSize: 32, fontFamily: fonts.display, letterSpacing: 0, color: colors.textPrimary },
  title: { fontSize: 23, fontFamily: fonts.display, letterSpacing: 0, color: colors.textPrimary },
  headline: { fontSize: 17, fontFamily: fonts.bold, letterSpacing: -0.2, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },
  label: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: 0.1, color: colors.textSecondary },
  caption: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted },
};

// 딜라이트 모션 (쥬시)
export const motion = {
  bouncy: { damping: 12, stiffness: 180, mass: 0.9 },
  squish: { damping: 15, stiffness: 320 },
  gentle: { damping: 20, stiffness: 200 },
};

export const shadow = {
  card: {
    shadowColor: '#C2707F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  floating: {
    shadowColor: '#B4586A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  glow: {
    shadowColor: '#E39BAB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 6,
  },
};
