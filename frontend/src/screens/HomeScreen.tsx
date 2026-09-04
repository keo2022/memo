import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../db/repository';
import type { EventItem } from '../types';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import RingMascot from '../components/mascot/RingMascot';
import EventEditModal from '../components/EventEditModal';
import { daysUntil, ddayLabel, formatKoreanDate } from '../lib/date';
import { useReduceMotion } from '../hooks/useReduceMotion';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; event: EventItem }
  | null;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await api.getEvents());
    } catch (e) {
      Alert.alert('불러오지 못했습니다', String(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // 서버가 날짜 오름차순으로 줍니다. 오늘 이후 중 가장 가까운 것을 대표로, 없으면 마지막(가장 최근 과거).
  const hero = useMemo(() => {
    if (events.length === 0) return null;
    return events.find((e) => daysUntil(e.date) >= 0) ?? events[events.length - 1];
  }, [events]);

  const rest = useMemo(() => events.filter((e) => e.id !== hero?.id), [events, hero]);

  const handleSubmit = async (title: string, date: string) => {
    if (modal?.mode === 'edit') {
      await api.updateEvent(modal.event.id, { title, date });
    } else {
      await api.createEvent(title, date);
    }
    await load();
  };

  const handleDelete = async () => {
    if (modal?.mode !== 'edit') return;
    await api.deleteEvent(modal.event.id);
    await load();
  };

  const heroDiff = hero ? daysUntil(hero.date) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.hello}>우리 결혼 준비</Text>
            <Text style={styles.helloSub}>둘이 함께 채워가요</Text>
          </View>
          <RingMascot size={52} mood="wink" animated />
        </View>

        {hero ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.heroCard}
              onPress={() => setModal({ mode: 'edit', event: hero })}
            >
              <Text style={styles.heroLabel}>{hero.title}</Text>
              <Text style={styles.heroDday}>{ddayLabel(hero.date)}</Text>
              <Text style={styles.heroDate}>{formatKoreanDate(hero.date)}</Text>
              <View style={styles.heroFootRow}>
                <Ionicons name="heart" size={13} color={colors.primaryDark} />
                <Text style={styles.heroFoot}>
                  {heroDiff > 0
                    ? `${heroDiff}일 남았어요`
                    : heroDiff === 0
                      ? '오늘이에요! 🎉'
                      : `${-heroDiff}일 지났어요`}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>날짜를 등록해보세요</Text>
            <Text style={styles.emptyText}>결혼식, 상견례, 기념일 같은 날을 더하면{'\n'}여기서 D-day로 볼 수 있어요</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => setModal({ mode: 'create' })}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.emptyCtaText}>기념일 추가</Text>
            </TouchableOpacity>
          </View>
        )}

        {rest.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>다른 날들</Text>
            {rest.map((e) => {
              const diff = daysUntil(e.date);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => setModal({ mode: 'edit', event: e })}
                >
                  <View style={styles.rowDdayWrap}>
                    <Text style={styles.rowDday}>{ddayLabel(e.date)}</Text>
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.rowDate}>{formatKoreanDate(e.date)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {loaded && (
        <TouchableOpacity
          style={[styles.fab, { bottom: spacing.lg }]}
          onPress={() => setModal({ mode: 'create' })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.fabText}>기념일</Text>
        </TouchableOpacity>
      )}

      <EventEditModal
        visible={modal !== null}
        mode={modal?.mode ?? 'create'}
        initialTitle={modal?.mode === 'edit' ? modal.event.title : undefined}
        initialDate={modal?.mode === 'edit' ? modal.event.date : undefined}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
        onDelete={modal?.mode === 'edit' ? handleDelete : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  hello: { ...type.display, fontSize: 26 },
  helloSub: { ...type.caption, marginTop: 4 },
  heroCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadow.glow,
  },
  heroLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: spacing.sm },
  heroDday: { fontSize: 52, fontFamily: fonts.display, color: colors.primaryDark, letterSpacing: 1 },
  heroDate: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: spacing.sm },
  heroFootRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  heroFoot: { fontSize: 13, fontFamily: fonts.bold, color: colors.primaryDark },
  emptyCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyTitle: { ...type.title, fontSize: 19, marginBottom: spacing.sm },
  emptyText: { textAlign: 'center', ...type.caption, fontSize: 13, lineHeight: 19 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.glow,
  },
  emptyCtaText: { color: colors.white, fontSize: 14, fontFamily: fonts.extrabold },
  listSection: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionTitle: { ...type.label, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDdayWrap: {
    minWidth: 56,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  rowDday: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.primaryDark },
  rowTextWrap: { flex: 1 },
  rowTitle: { ...type.headline, fontSize: 15 },
  rowDate: { ...type.caption, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.floating,
  },
  fabText: { color: colors.white, fontSize: 15, fontFamily: fonts.extrabold },
});
