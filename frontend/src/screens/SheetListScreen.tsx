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
import type { Sheet } from '../types';
import { colors, radius, spacing, shadow, type, fonts } from '../theme';
import { loadEditorName, saveEditorName, getCachedEditorName } from '../lib/identity';
import ScreenHeader from '../components/ScreenHeader';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';
import Squishy from '../components/Squishy';
import HeartBurst from '../components/HeartBurst';
import EmptyIllustration from '../components/illustrations/EmptyIllustration';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetList'>;

export default function SheetListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [actionTarget, setActionTarget] = useState<Sheet | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [burst, setBurst] = useState(0);
  const [editorName, setEditorName] = useState<string | null>(getCachedEditorName());
  const [nameModalVisible, setNameModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadEditorName().then(setEditorName);
    }, [])
  );

  const loadSheets = useCallback(async () => {
    try {
      setLoading(true);
      setSheets(await api.getSheets());
    } catch (e) {
      Alert.alert('시트를 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSheets();
    }, [loadSheets])
  );

  const handleAddSheet = async (name: string) => {
    try {
      await api.createSheet(name);
      setBurst((b) => b + 1);
      loadSheets();
    } catch (e) {
      Alert.alert('시트 생성 실패', String(e));
    }
  };

  const handleReorder = async (reordered: Sheet[]) => {
    setSheets(reordered);
    // 드래그 후 리스트를 강제로 다시 마운트해서, 내부 위치 캐시가 꼬여 생기는 빈 칸 현상을 막습니다.
    setListKey((k) => k + 1);
    try {
      await api.reorderSheets(reordered.map((s) => s.id));
    } catch (e) {
      Alert.alert('순서 변경 실패', String(e));
      loadSheets();
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Sheet>) => (
    <ScaleDecorator activeScale={1.04}>
      <Squishy
        style={[styles.sheetItem, isActive && styles.sheetItemActive]}
        onPress={() => navigation.navigate('TabDetail', { sheetId: item.id, sheetName: item.name })}
        onLongPress={drag}
        delayLongPress={220}
        disabled={isActive}
      >
        <View style={styles.sheetIconWrap}>
          <Ionicons name="albums" size={19} color={colors.primaryDark} />
        </View>
        <Text style={styles.sheetItemText} numberOfLines={1}>
          {item.name}
        </Text>
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
        title="시트"
        subtitle={sheets.length > 0 ? `시트 ${sheets.length}개 ✨` : '결혼 준비를 시트로 차곡차곡'}
      />

      <TouchableOpacity
        style={styles.editorChip}
        onPress={() => setNameModalVisible(true)}
        hitSlop={8}
        activeOpacity={0.7}
      >
        <Ionicons name="person-circle-outline" size={16} color={colors.primaryDark} />
        <Text style={styles.editorChipText} numberOfLines={1}>
          {editorName ? `${editorName} (편집 기록에 표시)` : '이름 설정하기'}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
      </TouchableOpacity>

      <DraggableFlatList
        key={listKey}
        data={sheets}
        keyExtractor={(item) => item.id}
        refreshing={loading && !firstLoad}
        onRefresh={loadSheets}
        contentContainerStyle={sheets.length === 0 ? styles.emptyContainer : styles.listContent}
        onDragEnd={({ data }) => handleReorder(data)}
        removeClippedSubviews={false}
        ListEmptyComponent={
          firstLoad ? null : (
            <View style={styles.empty}>
              <EmptyIllustration variant="sheets" />
              <Text style={styles.emptyTitle}>여기 아직 비어있어요</Text>
              <Text style={styles.emptyText}>첫 시트를 만들어 볼까요? 💍</Text>
              <Squishy style={styles.emptyCta} onPress={() => setAddModalVisible(true)}>
                <Ionicons name="add" size={20} color={colors.white} />
                <Text style={styles.emptyCtaText}>새 시트 만들기</Text>
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
          <Text style={styles.fabText}>새 시트</Text>
        </Squishy>
      </Animated.View>

      <HeartBurst trigger={burst} originY={0.72} />

      <NamePromptModal
        visible={addModalVisible}
        title="새 시트 추가"
        placeholder="시트 이름"
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleAddSheet}
      />

      <NamePromptModal
        visible={nameModalVisible}
        title="이름 바꾸기"
        confirmLabel="저장"
        onClose={() => setNameModalVisible(false)}
        onConfirm={async (name) => {
          await saveEditorName(name);
          setEditorName(name.trim());
        }}
      />

      <ItemActionModal
        visible={!!actionTarget}
        itemName={actionTarget?.name ?? ''}
        itemTypeLabel="시트"
        deleteWarning={`"${actionTarget?.name ?? ''}"`}
        onClose={() => setActionTarget(null)}
        onRename={async (name) => {
          if (!actionTarget) return;
          try {
            await api.renameSheet(actionTarget.id, name);
            loadSheets();
          } catch (e) {
            Alert.alert('이름 변경 실패', String(e));
          }
        }}
        onDelete={async () => {
          if (!actionTarget) return;
          try {
            await api.deleteSheet(actionTarget.id);
            loadSheets();
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
  editorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  editorChipText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primaryDark, maxWidth: 240 },
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
  sheetItem: {
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
  sheetItemActive: { borderColor: colors.primarySoftBorder, ...shadow.floating },
  sheetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  sheetItemText: { flex: 1, ...type.headline },
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
