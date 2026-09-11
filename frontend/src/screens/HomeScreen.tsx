import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ConflictError } from '../db/repository';
import type { EventItem, EventLink, MemoSummary, Sheet } from '../types';
import { colors, radius, spacing, shadow, fonts, type } from '../theme';
import EventEditModal, { type EventFormValue } from '../components/EventEditModal';
import EventDetailModal from '../components/EventDetailModal';
import EventLinkModal from '../components/EventLinkModal';
import PastEventsModal from '../components/PastEventsModal';
import SettingsModal from '../components/SettingsModal';
import { daysUntil, ddayLabel, formatKoreanDate, formatKoreanTime, todayLabel } from '../lib/date';
import { friendlyMessage } from '../lib/errors';
import { syncEventReminders } from '../lib/notifications';
import { useReduceMotion } from '../hooks/useReduceMotion';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; event: EventItem }
  | null;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const reduceMotion = useReduceMotion();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [linkTarget, setLinkTarget] = useState<EventItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<EventItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [notifRev, setNotifRev] = useState(0);

  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, me, sh] = await Promise.all([api.getEvents(), api.getMemos(), api.getSheets()]);
      setEvents(ev);
      setMemos(me);
      setSheets(sh);
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
      Alert.alert('불러오지 못했어요', friendlyMessage(e));
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

  // 일정이 바뀌거나(서버에서 새로 받아옴) 알림 설정을 바꾸면 로컬 알림을 다시 예약합니다.
  useEffect(() => {
    if (loaded) syncEventReminders(events).catch(() => {});
  }, [events, notifRev, loaded]);

  // 앱을 켜 둔 채 자정이 지나도 D-day가 하루 밀리도록, 날짜가 바뀌는 시점에 한 번 리렌더합니다.
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime();
    const timer = setTimeout(() => setDayTick((n) => n + 1), Math.max(1000, nextMidnight - now.getTime()));
    return () => clearTimeout(timer);
  }, [dayTick]);

  // 서버가 pinned 먼저, 그다음 날짜 오름차순으로 줍니다.
  // 고정한 일정은 공지처럼 항상 위에, 나머지는 아직 안 지난 일정만 메인에 보이고 지난 건 따로 모달로.
  const pinned = useMemo(() => events.filter((e) => e.pinned), [events]);
  const upcoming = useMemo(
    () => events.filter((e) => !e.pinned && daysUntil(e.date) >= 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, dayTick]
  );
  const past = useMemo(
    () => events.filter((e) => !e.pinned && daysUntil(e.date) < 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, dayTick]
  );

  const hero = useMemo(() => pinned[0] ?? upcoming[0] ?? null, [pinned, upcoming]);
  const rest = useMemo(
    () => [...pinned, ...upcoming].filter((e) => e.id !== hero?.id),
    [pinned, upcoming, hero]
  );

  // 상세 모달은 스냅샷 대신 최신 events에서 다시 찾아 보여줍니다(수정 후에도 최신 유지).
  const detailEvent = useMemo(
    () => (detailTarget ? events.find((e) => e.id === detailTarget.id) ?? detailTarget : null),
    [detailTarget, events]
  );

  const handleSubmit = async (v: EventFormValue) => {
    if (modal?.mode === 'edit') {
      try {
        await api.updateEvent(
          modal.event.id,
          {
            title: v.title,
            date: v.date,
            pinned: v.pinned,
            time: v.time,
            location: v.location,
            note: v.note,
          },
          modal.event.updatedAt ?? null
        );
      } catch (e) {
        if (e instanceof ConflictError) {
          // 셀/메모처럼 "누구 걸 남길지" 고르는 대신, 상대가 막 고친 내용을 보여주고 다시 편집하게 합니다
          // (일정은 필드가 여러 개라 두 버전을 한 화면에서 병합하기보다 최신 내용을 보고 다시 고치는 편이 안전해요).
          await load();
          Alert.alert(
            '방금 상대방이 이 일정을 수정했어요',
            '최신 내용으로 새로고침했어요. 다시 열어서 확인한 뒤 고쳐주세요.'
          );
          return;
        }
        throw e;
      }
    } else {
      await api.createEvent(v);
    }
    await load();
  };

  const handleDelete = async () => {
    if (modal?.mode !== 'edit') return;
    await api.deleteEvent(modal.event.id);
    await load();
  };

  const handleSaveLinks = async (links: EventLink[]) => {
    if (!linkTarget) return;
    await api.setEventLinks(linkTarget.id, links);
    await load();
  };

  // 연결된 항목의 현재 이름. 삭제됐으면 null.
  const linkLabel = useCallback(
    (link: EventLink): string | null => {
      if (link.kind === 'memo') return memos.find((m) => m.id === link.refId)?.title ?? null;
      return sheets.find((s) => s.id === link.refId)?.name ?? null;
    },
    [memos, sheets]
  );

  const openLink = useCallback(
    (link: EventLink) => {
      if (link.kind === 'memo') {
        const m = memos.find((x) => x.id === link.refId);
        if (!m) return Alert.alert('메모를 찾을 수 없어요', '삭제되었을 수 있어요.');
        navigation.navigate('Memo', { screen: 'MemoDetail', params: { memoId: m.id, memoTitle: m.title } });
      } else {
        const s = sheets.find((x) => x.id === link.refId);
        if (!s) return Alert.alert('시트를 찾을 수 없어요', '삭제되었을 수 있어요.');
        navigation.navigate('Excel', { screen: 'TabDetail', params: { sheetId: s.id, sheetName: s.name } });
      }
    },
    [memos, sheets, navigation]
  );

  const renderChips = (event: EventItem, center: boolean) => {
    const items = (event.links ?? [])
      .map((link) => ({ link, label: linkLabel(link) }))
      .filter((x): x is { link: EventLink; label: string } => x.label !== null);
    if (items.length === 0) return null;
    return (
      <View style={[styles.chipRow, center && styles.chipRowCenter]}>
        {items.map(({ link, label }) => (
          <TouchableOpacity
            key={link.kind + link.refId}
            style={styles.chip}
            activeOpacity={0.7}
            onPress={() => openLink(link)}
          >
            <Ionicons
              name={link.kind === 'memo' ? 'document-text' : 'grid'}
              size={12}
              color={colors.primaryDark}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
          <Text style={styles.today}>{todayLabel()}</Text>
          <TouchableOpacity
            onPress={() => setSettingsOpen(true)}
            hitSlop={10}
            style={styles.gearButton}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!loaded ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl * 2 }} />
        ) : loadError && events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>불러오지 못했어요</Text>
            <Text style={styles.emptyText}>{'인터넷 연결을 확인하고\n다시 시도해주세요'}</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={load}>
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.emptyCtaText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : hero ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.heroCard}
              onPress={() => setDetailTarget(hero)}
              onLongPress={() => setLinkTarget(hero)}
              delayLongPress={300}
            >
              <View style={styles.heroLabelRow}>
                {hero.pinned && <Ionicons name="pin" size={13} color={colors.primaryDark} />}
                <Text style={styles.heroLabel}>{hero.title}</Text>
              </View>
              <Text style={styles.heroDday}>{ddayLabel(hero.date)}</Text>
              <Text style={styles.heroDate}>
                {formatKoreanDate(hero.date)}
                {hero.time ? ` · ${formatKoreanTime(hero.time)}` : ''}
              </Text>
              {!!hero.location && (
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.heroMetaText} numberOfLines={1}>
                    {hero.location}
                  </Text>
                </View>
              )}
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
              {(hero.links ?? []).length > 0 ? (
                renderChips(hero, true)
              ) : (
                <Text style={styles.heroHint}>꾹 누르면 메모·엑셀을 연결할 수 있어요</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {past.length > 0 ? '다가오는 일정이 없어요' : '날짜를 등록해보세요'}
            </Text>
            <Text style={styles.emptyText}>
              {past.length > 0
                ? '지난 일정은 아래에서 볼 수 있어요\n새 날짜를 더해보세요'
                : '결혼식, 상견례 같은 날을 더하면\n여기서 D-day로 볼 수 있어요'}
            </Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => setModal({ mode: 'create' })}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.emptyCtaText}>추가</Text>
            </TouchableOpacity>
          </View>
        )}

        {rest.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>다른 날들</Text>
            {rest.map((e) => {
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => setDetailTarget(e)}
                  onLongPress={() => setLinkTarget(e)}
                  delayLongPress={300}
                >
                  <View style={[styles.rowDdayWrap, e.pinned && styles.rowDdayWrapPinned]}>
                    <Text style={styles.rowDday}>{ddayLabel(e.date)}</Text>
                  </View>
                  <View style={styles.rowTextWrap}>
                    <View style={styles.rowTitleRow}>
                      {e.pinned && <Ionicons name="pin" size={12} color={colors.primaryDark} />}
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {e.title}
                      </Text>
                    </View>
                    <Text style={styles.rowDate} numberOfLines={1}>
                      {formatKoreanDate(e.date)}
                      {e.time ? ` · ${formatKoreanTime(e.time)}` : ''}
                      {e.location ? ` · ${e.location}` : ''}
                    </Text>
                    {renderChips(e, false)}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {past.length > 0 && (
          <TouchableOpacity
            style={styles.pastButton}
            activeOpacity={0.7}
            onPress={() => setPastOpen(true)}
          >
            <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.pastButtonText}>지난 일정 {past.length}개 보기</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {loaded && (
        <TouchableOpacity
          style={[styles.fab, { bottom: spacing.lg }]}
          onPress={() => setModal({ mode: 'create' })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.fabText}>추가</Text>
        </TouchableOpacity>
      )}

      <EventDetailModal
        visible={detailEvent !== null}
        event={detailEvent}
        linkLabel={linkLabel}
        onOpenLink={openLink}
        onClose={() => setDetailTarget(null)}
        onEdit={() => {
          if (!detailEvent) return;
          const ev = detailEvent;
          setDetailTarget(null);
          setModal({ mode: 'edit', event: ev });
        }}
        onManageLinks={() => {
          if (!detailEvent) return;
          const ev = detailEvent;
          setDetailTarget(null);
          setLinkTarget(ev);
        }}
      />

      <EventEditModal
        visible={modal !== null}
        mode={modal?.mode ?? 'create'}
        initialTitle={modal?.mode === 'edit' ? modal.event.title : undefined}
        initialDate={modal?.mode === 'edit' ? modal.event.date : undefined}
        initialPinned={modal?.mode === 'edit' ? modal.event.pinned : undefined}
        initialTime={modal?.mode === 'edit' ? modal.event.time : undefined}
        initialLocation={modal?.mode === 'edit' ? modal.event.location : undefined}
        initialNote={modal?.mode === 'edit' ? modal.event.note : undefined}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
        onDelete={modal?.mode === 'edit' ? handleDelete : undefined}
      />

      <PastEventsModal
        visible={pastOpen}
        events={past}
        onClose={() => setPastOpen(false)}
        onSelect={(e) => {
          setPastOpen(false);
          setDetailTarget(e);
        }}
      />

      <EventLinkModal
        visible={linkTarget !== null}
        event={linkTarget}
        memos={memos}
        sheets={sheets}
        onClose={() => setLinkTarget(null)}
        onSave={handleSaveLinks}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNotificationChange={() => setNotifRev((n) => n + 1)}
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
  today: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary, letterSpacing: 0.2 },
  gearButton: { padding: 4 },
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
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.sm },
  heroLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  heroDday: { fontSize: 52, fontFamily: fonts.display, color: colors.primaryDark, letterSpacing: 1 },
  heroDate: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: spacing.sm },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    maxWidth: '90%',
  },
  heroMetaText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, flexShrink: 1 },
  heroFootRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  heroFoot: { fontSize: 13, fontFamily: fonts.bold, color: colors.primaryDark },
  heroHint: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, marginTop: spacing.md },
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
  rowDdayWrapPinned: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoftBorder },
  rowDday: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.primaryDark },
  rowTextWrap: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTitle: { ...type.headline, fontSize: 15, flexShrink: 1 },
  rowDate: { ...type.caption, marginTop: 2 },
  pastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  pastButtonText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chipRowCenter: { justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.primaryDark },
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
