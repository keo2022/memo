import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Tab } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';

type Props = NativeStackScreenProps<RootStackParamList, 'TabList'>;

export default function TabListScreen({ route, navigation }: Props) {
  const { sheetId, sheetName } = route.params;
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<Tab | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [listKey, setListKey] = useState(0);

  const loadTabs = useCallback(async () => {
    try {
      setLoading(true);
      setTabs(await api.getTabs(sheetId));
    } catch (e) {
      Alert.alert('탭을 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
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
    <ScaleDecorator>
      <TouchableOpacity
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TabDetail', { sheetId, sheetName, tabId: item.id, tabName: item.name })}
        onLongPress={drag}
        disabled={isActive}
      >
        <View style={styles.tabIconWrap}>
          <Ionicons name="grid" size={20} color={colors.primary} />
        </View>
        <View style={styles.tabTextWrap}>
          <Text style={styles.tabItemText} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.tabSubText}>
            {item.rows}행 × {item.cols}열
          </Text>
        </View>
        <Ionicons name="reorder-three-outline" size={20} color={colors.textMuted} />
        <TouchableOpacity onPress={() => setActionTarget(item)} hitSlop={8} style={styles.itemMenuButton}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container}>
      <DraggableFlatList
        key={listKey}
        data={tabs}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadTabs}
        contentContainerStyle={tabs.length === 0 ? styles.emptyContainer : styles.listContent}
        onDragEnd={({ data }) => handleReorder(data)}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>탭이 없습니다{'\n'}아래 + 버튼으로 새 탭을 추가해보세요</Text>
          </View>
        }
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

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
        deleteWarning={`"${actionTarget?.name ?? ''}" 탭의 모든 데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없어요.`}
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
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  listContent: { paddingBottom: spacing.xl * 2 },
  emptyContainer: { flexGrow: 1 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  tabItemActive: { backgroundColor: colors.primarySoft, ...shadow.floating },
  tabIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tabTextWrap: { flex: 1 },
  tabItemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  tabSubText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemMenuButton: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
