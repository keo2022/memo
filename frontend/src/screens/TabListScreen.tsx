import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Tab } from '../types';
import { colors, radius, spacing, shadow, type, fonts } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';
import Squishy from '../components/Squishy';
import HeartBurst from '../components/HeartBurst';
import EmptyIllustration from '../components/illustrations/EmptyIllustration';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'TabList'>;

export default function TabListScreen({ route, navigation }: Props) {
  const { sheetId, sheetName } = route.params;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [actionTarget, setActionTarget] = useState<Tab | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [burst, setBurst] = useState(0);

  const loadTabs = useCallback(async () => {
    try {
      setLoading(true);
      setTabs(await api.getTabs(sheetId));
    } catch (e) {
      Alert.alert('탭을 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [sheetId]);

  useFocusEffect(
    useCallback(() => {
      loadTabs();
    }, [loadTabs])
  );

  const handleAddTab = async (name: string) => {
    try {
      await api.createTab(sheetId, name);
      setBurst((b) => b + 1);
      loadTabs();
    } catch (e) {
      Alert.alert('탭 생성 실패', String(e));
    }
  };

  const handleReorder = async (reordered: Tab[]) => {
    setTabs(reordered);
    // 드래그 후 리스트를 강제로 다시 마운트해서, 내부 위치 캐시가 꼬여 생기는 빈 칸 현상을 막습니다.
    setListKey((k) => k + 1);
    try {
      await api.reorderTabs(sheetId, reordered.map((t) => t.id));
    } catch (e) {
      Alert.alert('순서 변경 실패', String(e));
      loadTabs();
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Tab>) => (
    <ScaleDecorator activeScale={1.04}>
      <Squishy
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        onPress={() => navigation.navigate('TabDetail', { sheetId, sheetName, tabId: item.id, tabName: item.name })}
        onLongPress={drag}
        delayLongPress={220}
        disabled={isActive}
      >
        <View style={styles.tabIconWrap}>
          <Ionicons name="grid" size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.tabTextWrap}>
          <Text style={styles.tabItemText} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.tabSubText}>
            {item.rows}행 × {item.cols}열
          </Text>
        </View>
        <TouchableOpacity onPress={drag} hitSlop={8} style={styles.dragHandle}>
          <Ionicons name="reorder-two-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActionTarget(item)} hitSlop={8} style={styles.itemMenuButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Squishy>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={sheetName}
        subtitle={tabs.length > 0 ? `탭 ${tabs.length}개 ✨` : '탭으로 표를 나눠서'}
        onBack={() => navigation.goBack()}
      />

      <DraggableFlatList
        key={listKey}
        data={tabs}
        keyExtractor={(item) => item.id}
        refreshing={loading && !firstLoad}
        onRefresh={loadTabs}
        contentContainerStyle={tabs.length === 0 ? styles.emptyContainer : styles.listContent}
        onDragEnd={({ data }) => handleReorder(data)}
        removeClippedSubviews={false}
        ListEmptyComponent={
          firstLoad ? null : (
            <View style={styles.empty}>
              <EmptyIllustration variant="tabs" />
              <Text style={styles.emptyTitle}>아직 탭이 없어요</Text>
              <Text style={styles.emptyText}>새 탭을 만들어 볼까요? 🤍</Text>
              <Squishy style={styles.emptyCta} onPress={() => setAddModalVisible(true)}>
                <Ionicons name="add" size={20} color={colors.white} />
                <Text style={styles.emptyCtaText}>새 탭 만들기</Text>
              </Squishy>
            </View>
          )
        }
        renderItem={renderItem}
      />

      <Animated.View
        entering={reduceMotion ? undefined : BounceIn.delay(150)}
        style={[styles.fabWrap, { bottom: insets.bottom + spacing.lg }]}
      >
        <Squishy style={styles.fab} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.fabText}>새 탭</Text>
        </Squishy>
      </Animated.View>

      <HeartBurst trigger={burst} originY={0.72} />

      <NamePromptModal
        visible={addModalVisible}
        title="새 탭 추가"
        placeholder="탭 이름"
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleAddTab}
      />

      <ItemActionModal
        visible={!!actionTarget}
        itemName={actionTarget?.name ?? ''}
        itemTypeLabel="탭"
        deleteWarning={`"${actionTarget?.name ?? ''}"`}
        onClose={() => setActionTarget(null)}
        onRename={async (name) => {
          if (!actionTarget) return;
          try {
            await api.renameTab(actionTarget.id, name);
            loadTabs();
          } catch (e) {
            Alert.alert('이름 변경 실패', String(e));
          }
        }}
        onDelete={async () => {
          if (!actionTarget) return;
          try {
            await api.deleteTab(actionTarget.id);
            loadTabs();
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
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxl * 3 },
  emptyContainer: { flexGrow: 1, paddingHorizontal: spacing.lg },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow.glow,
  },
  tabItemActive: { borderColor: colors.primarySoftBorder, ...shadow.floating },
  tabIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  tabTextWrap: { flex: 1 },
  tabItemText: { ...type.headline },
  tabSubText: { ...type.caption, marginTop: 3 },
  dragHandle: { padding: 4 },
  itemMenuButton: { padding: 4 },
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
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.glow,
  },
  emptyCtaText: { color: colors.white, fontSize: 15, fontFamily: fonts.extrabold },
});
