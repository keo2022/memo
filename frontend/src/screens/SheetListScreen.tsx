import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Sheet } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetList'>;

export default function SheetListScreen({ navigation }: Props) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<Sheet | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [listKey, setListKey] = useState(0);

  const loadSheets = useCallback(async () => {
    try {
      setLoading(true);
      setSheets(await api.getSheets());
    } catch (e) {
      Alert.alert('시트를 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
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
    <ScaleDecorator>
      <TouchableOpacity
        style={[styles.sheetItem, isActive && styles.sheetItemActive]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TabDetail', { sheetId: item.id, sheetName: item.name })}
        onLongPress={drag}
        disabled={isActive}
      >
        <View style={styles.sheetIconWrap}>
          <Ionicons name="folder" size={20} color={colors.primary} />
        </View>
        <Text style={styles.sheetItemText} numberOfLines={1}>
          {item.name}
        </Text>
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
        data={sheets}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadSheets}
        contentContainerStyle={sheets.length === 0 ? styles.emptyContainer : styles.listContent}
        onDragEnd={({ data }) => handleReorder(data)}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>시트가 없습니다{'\n'}아래 + 버튼으로 새 시트를 추가해보세요</Text>
          </View>
        }
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <NamePromptModal
        visible={addModalVisible}
        title="새 시트 추가"
        placeholder="시트 이름"
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleAddSheet}
      />

      <ItemActionModal
        visible={!!actionTarget}
        itemName={actionTarget?.name ?? ''}
        itemTypeLabel="시트"
        deleteWarning={`"${actionTarget?.name ?? ''}" 시트와 그 안의 모든 탭·데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없어요.`}
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
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  sheetItemActive: { backgroundColor: colors.primarySoft, ...shadow.floating },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sheetItemText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  itemMenuButton: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
