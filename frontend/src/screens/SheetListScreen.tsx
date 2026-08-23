import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../db/repository';
import type { Sheet } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetList'>;

export default function SheetListScreen({ route, navigation }: Props) {
  const { menuId } = route.params;
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [newSheetName, setNewSheetName] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleAddSheet = async () => {
    if (!newSheetName.trim()) return;
    try {
      await api.createSheet(menuId, newSheetName.trim());
      setNewSheetName('');
      loadSheets();
    } catch (e) {
      Alert.alert('시트 생성 실패', String(e));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="새 시트 이름 (예: 8월)"
          value={newSheetName}
          onChangeText={setNewSheetName}
          onSubmitEditing={handleAddSheet}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddSheet}>
          <Text style={styles.addButtonText}>추가</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadSheets}
        ListEmptyComponent={<Text style={styles.empty}>시트가 없습니다. 위에서 추가해보세요.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SheetDetail', { sheetId: item.id, sheetName: item.name })}
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
