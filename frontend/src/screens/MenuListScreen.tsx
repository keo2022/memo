import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Menu } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuList'>;

export default function MenuListScreen({ navigation }: Props) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [loading, setLoading] = useState(false);

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
        <TextInput
          style={styles.input}
          placeholder="새 메뉴 이름 (예: 가계부, 운동일지)"
          value={newMenuName}
          onChangeText={setNewMenuName}
          onSubmitEditing={handleAddMenu}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddMenu}>
          <Text style={styles.addButtonText}>추가</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={menus}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadMenus}
        ListEmptyComponent={<Text style={styles.empty}>메뉴가 없습니다. 위에서 추가해보세요.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SheetList', { menuId: item.id, menuName: item.name })}
          >
            <Text style={styles.menuItemText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  addRow: { flexDirection: 'row', marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600' },
  menuItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuItemText: { fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
