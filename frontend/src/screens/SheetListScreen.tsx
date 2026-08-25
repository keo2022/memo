import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

export default function SheetListScreen({ route, navigation }: Props) {
  const { menuId } = route.params;
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<Sheet | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const loadSheets = useCallback(async () => {
    try {
      setLoading(true);
      setSheets(await api.getSheets(menuId));
    } catch (e) {
      Alert.alert('시트를 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useFocusEffect(
    useCallback(() => {
      loadSheets();
    }, [loadSheets])
  );

  const handleAddSheet = async (name: string) => {
    try {
      await api.createSheet(menuId, name);
      loadSheets();
    } catch (e) {
      Alert.alert('시트 생성 실패', String(e));
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadSheets}
        contentContainerStyle={sheets.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>시트가 없습니다{'\n'}아래 + 버튼으로 새 시트를 추가해보세요</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.sheetItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SheetDetail', { sheetId: item.id, sheetName: item.name })}
            onLongPress={() => setActionTarget(item)}
          >
            <View style={styles.sheetIconWrap}>
              <Ionicons name="grid" size={20} color={colors.primary} />
            </View>
            <View style={styles.sheetTextWrap}>
              <Text style={styles.sheetItemText} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sheetSubText}>
                {item.rows}행 × {item.cols}열
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
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
        deleteWarning={`"${actionTarget?.name ?? ''}" 시트의 모든 데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없어요.`}
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
    ...shadow.card,
  },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sheetTextWrap: { flex: 1 },
  sheetItemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  sheetSubText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
