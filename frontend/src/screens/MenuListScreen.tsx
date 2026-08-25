import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Menu } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import ItemActionModal from '../components/ItemActionModal';
import NamePromptModal from '../components/NamePromptModal';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuList'>;

export default function MenuListScreen({ navigation }: Props) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<Menu | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const loadMenus = useCallback(async () => {
    try {
      setLoading(true);
      setMenus(await api.getMenus());
    } catch (e) {
      Alert.alert('메뉴를 불러오지 못했습니다', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMenus();
    }, [loadMenus])
  );

  const handleAddMenu = async (name: string) => {
    try {
      await api.createMenu(name);
      loadMenus();
    } catch (e) {
      Alert.alert('메뉴 생성 실패', String(e));
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={menus}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadMenus}
        contentContainerStyle={menus.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>메뉴가 없습니다{'\n'}아래 + 버튼으로 새 메뉴를 추가해보세요</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SheetList', { menuId: item.id, menuName: item.name })}
            onLongPress={() => setActionTarget(item)}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name="folder" size={20} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <NamePromptModal
        visible={addModalVisible}
        title="새 메뉴 추가"
        placeholder="메뉴 이름"
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleAddMenu}
      />

      <ItemActionModal
        visible={!!actionTarget}
        itemName={actionTarget?.name ?? ''}
        itemTypeLabel="메뉴"
        deleteWarning={`"${actionTarget?.name ?? ''}" 메뉴와 그 안의 모든 시트·데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없어요.`}
        onClose={() => setActionTarget(null)}
        onRename={async (name) => {
          if (!actionTarget) return;
          try {
            await api.renameMenu(actionTarget.id, name);
            loadMenus();
          } catch (e) {
            Alert.alert('이름 변경 실패', String(e));
          }
        }}
        onDelete={async () => {
          if (!actionTarget) return;
          try {
            await api.deleteMenu(actionTarget.id);
            loadMenus();
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuItemText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
