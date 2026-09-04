import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemoStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { MemoSummary } from '../types';
import { colors, radius, spacing, shadow, type, fonts } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';
import Squishy from '../components/Squishy';
import EmptyIllustration from '../components/illustrations/EmptyIllustration';
import { relativeTime } from '../lib/date';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = NativeStackScreenProps<MemoStackParamList, 'MemoList'>;

export default function MemoListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [actionTarget, setActionTarget] = useState<MemoSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMemos(await api.getMemos());
    } catch (e) {
      Alert.alert('메모를 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = async (title: string) => {
    try {
      const memo = await api.createMemo(title);
      setAddVisible(false);
      await load();
      navigation.navigate('MemoDetail', { memoId: memo.id, memoTitle: memo.title });
    } catch (e) {
      Alert.alert('메모 생성 실패', String(e));
    }
  };

  const renderItem = ({ item }: { item: MemoSummary }) => (
    <Squishy
      style={styles.item}
      onPress={() => navigation.navigate('MemoDetail', { memoId: item.id, memoTitle: item.title })}
    >
      <View style={styles.itemIconWrap}>
        <Ionicons name="document-text" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.itemTextWrap}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {item.updatedAt
            ? `${item.updatedBy ?? '알 수 없음'} · ${relativeTime(item.updatedAt)}`
            : '아직 비어 있어요'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => setActionTarget(item)} hitSlop={8} style={styles.itemMenu}>
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </Squishy>
  );

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="메모" subtitle={memos.length > 0 ? `메모 ${memos.length}개` : '함께 쓰는 메모장'} />
      </View>

      <FlatList
        data={memos}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={memos.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && !firstLoad}
            onRefresh={load}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          firstLoad ? null : (
            <View style={styles.empty}>
              <EmptyIllustration variant="tabs" />
              <Text style={styles.emptyTitle}>메모가 없어요</Text>
              <Text style={styles.emptyText}>메모1, 메모2 처럼 만들어{'\n'}둘이 함께 적어보세요 ✍️</Text>
              <Squishy style={styles.emptyCta} onPress={() => setAddVisible(true)}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.emptyCtaText}>새 메모</Text>
              </Squishy>
            </View>
          )
        }
      />

      <Animated.View
        entering={reduceMotion ? undefined : BounceIn.delay(150)}
        style={[styles.fabWrap, { bottom: insets.bottom + spacing.lg }]}
      >
        <Squishy style={styles.fab} onPress={() => setAddVisible(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.fabText}>새 메모</Text>
        </Squishy>
      </Animated.View>

      <NamePromptModal
        visible={addVisible}
        title="새 메모"
        confirmLabel="만들기"
        onClose={() => setAddVisible(false)}
        onConfirm={handleAdd}
      />

      <ItemActionModal
        visible={!!actionTarget}
        itemName={actionTarget?.title ?? ''}
        itemTypeLabel="메모"
        deleteWarning={`"${actionTarget?.title ?? ''}" 메모를 삭제할까요?`}
        onClose={() => setActionTarget(null)}
        onRename={async (name) => {
          if (!actionTarget) return;
          try {
            await api.updateMemo(actionTarget.id, { title: name });
            await load();
          } catch (e) {
            Alert.alert('이름 변경 실패', String(e));
          }
        }}
        onDelete={async () => {
          if (!actionTarget) return;
          try {
            await api.deleteMemo(actionTarget.id);
            await load();
          } catch (e) {
            Alert.alert('삭제 실패', String(e));
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl * 3 },
  emptyContainer: { flexGrow: 1, paddingHorizontal: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow.glow,
  },
  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextWrap: { flex: 1 },
  itemTitle: { ...type.headline },
  itemMeta: { ...type.caption, marginTop: 3 },
  itemMenu: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyTitle: { ...type.title, marginTop: spacing.sm },
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
  fabWrap: { position: 'absolute', right: spacing.lg, ...shadow.floating },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  fabText: { color: colors.white, fontSize: 15, fontFamily: fonts.extrabold, letterSpacing: -0.2 },
});
