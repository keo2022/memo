import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Menu } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import ItemActionModal from '../components/ItemActionModal';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuList'>;

export default function MenuListScreen({ navigation }: Props) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<Menu | null>(null);

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

  const handleAddMenu = async () => {
    if (!newMenuName.trim()) return;
    try {
      await api.createMenu(newMenuName.trim());
      setNewMenuName('');
      loadMenus();
    } catch (e) {
      Alert.alert('메뉴 생성 실패', String(e));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <View style={styles.inputWrapper}>
          <Ionicons name="folder-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="새 메뉴 이름 (예: 가계부, 운동일지)"
            placeholderTextColor={colors.textMuted}
            value={newMenuName}
            onChangeText={setNewMenuName}
            onSubmitEditing={handleAddMenu}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          style={[styles.addButton, !newMenuName.trim() && styles.addButtonDisabled]}
          onPress={handleAddMenu}
          disabled={!newMenuName.trim()}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={menus}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadMenus}
        contentContainerStyle={menus.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>메뉴가 없습니다{'\n'}위에서 새 메뉴를 추가해보세요</Text>
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
  addRow: { flexDirection: 'row', marginBottom: spacing.lg, alignItems: 'center' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    ...shadow.card,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  addButtonDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0 },
  listContent: { paddingBottom: spacing.xl },
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
