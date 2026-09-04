import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemoStackParamList } from '../navigation/RootNavigator';
import { api, ConflictError, type MemoConflictCurrent } from '../db/repository';
import type { Memo } from '../types';
import { colors, radius, spacing, shadow, fonts } from '../theme';
import { relativeTime } from '../lib/date';

type Props = NativeStackScreenProps<MemoStackParamList, 'MemoDetail'>;

const POLL_INTERVAL_MS = 15000;

export default function MemoDetailScreen({ route, navigation }: Props) {
  const { memoId } = route.params;
  const [memo, setMemo] = useState<Memo | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [conflict, setConflict] = useState<MemoConflictCurrent | null>(null);

  const dirty = content !== savedContent;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty || saving || conflict !== null;

  const applyMemo = useCallback((m: Memo, keepDraft: boolean) => {
    setMemo(m);
    setSavedContent(m.content);
    setBaseUpdatedAt(m.updatedAt ?? null);
    if (!keepDraft) setContent(m.content);
  }, []);

  const load = useCallback(
    async (keepDraft: boolean) => {
      try {
        const m = await api.getMemo(memoId);
        applyMemo(m, keepDraft);
      } catch (e) {
        Alert.alert('메모를 불러오지 못했습니다', String(e));
      }
    },
    [memoId, applyMemo]
  );

  useFocusEffect(
    useCallback(() => {
      // 편집 중이면 초안을 지키고, 아니면 서버 내용으로 맞춥니다. 폴링도 편집 중이 아닐 때만.
      load(dirtyRef.current);
      const id = setInterval(() => {
        if (!dirtyRef.current) load(false);
      }, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [load])
  );

  const save = useCallback(async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const updated = await api.updateMemo(memoId, { content }, baseUpdatedAt);
      applyMemo(updated, false);
      setContent(updated.content);
    } catch (e) {
      if (e instanceof ConflictError) {
        setConflict(e.current as MemoConflictCurrent);
      } else {
        Alert.alert('저장 실패', String(e));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, memoId, content, baseUpdatedAt, applyMemo]);

  const overwriteWithMine = async () => {
    const c = conflict;
    setConflict(null);
    if (!c) return;
    setSaving(true);
    try {
      const updated = await api.updateMemo(memoId, { content }, c.updatedAt ?? null);
      applyMemo(updated, false);
      setContent(updated.content);
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.current as MemoConflictCurrent);
      else Alert.alert('저장 실패', String(e));
    } finally {
      setSaving(false);
    }
  };

  const takeTheirs = () => {
    if (conflict) {
      setContent(conflict.content);
      setSavedContent(conflict.content);
      setBaseUpdatedAt(conflict.updatedAt ?? null);
    }
    setConflict(null);
  };

  const onRefresh = useCallback(async () => {
    if (dirty && !(await confirmDiscard())) return;
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [dirty, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : dirty ? (
          <TouchableOpacity onPress={save} hitSlop={8}>
            <Text style={styles.saveButton}>저장</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.savedWrap}>
            <Ionicons name="checkmark-circle" size={16} color={colors.mint} />
            <Text style={styles.savedText}>저장됨</Text>
          </View>
        ),
    });
  }, [navigation, saving, dirty, save]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {memo?.updatedAt && (
          <Text style={styles.meta}>
            마지막 수정 · {memo.updatedBy ?? '알 수 없음'} · {relativeTime(memo.updatedAt)}
          </Text>
        )}
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />
      </ScrollView>

      {dirty && !saving && (
        <View style={styles.dirtyBar}>
          <Text style={styles.dirtyText}>저장하지 않은 변경이 있어요</Text>
          <TouchableOpacity onPress={save} style={styles.dirtyBarButton}>
            <Text style={styles.dirtyBarButtonText}>저장</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!conflict} transparent animationType="fade" onRequestClose={() => setConflict(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>충돌</Text>
            <Text style={styles.modalLead}>
              {conflict?.updatedBy ? `${conflict.updatedBy}님이` : '상대방이'} 먼저 이 메모를 저장했어요.
              {'\n'}어떻게 할까요?
            </Text>
            <TouchableOpacity style={[styles.modalButton, styles.modalPrimary]} onPress={overwriteWithMine}>
              <Text style={styles.modalPrimaryText}>내 내용으로 덮어쓰기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalGhost]} onPress={takeTheirs}>
              <Text style={styles.modalGhostText}>상대 내용 불러오기 (내 변경 버림)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalGhost]} onPress={() => setConflict(null)}>
              <Text style={styles.modalGhostText}>취소 (계속 편집)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function confirmDiscard(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('저장하지 않은 변경이 있어요', '새로고침하면 지금 입력한 내용이 사라집니다.', [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '버리고 새로고침', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, flexGrow: 1 },
  meta: { ...{ fontSize: 12, fontFamily: fonts.medium }, color: colors.textMuted, marginBottom: spacing.md },
  input: {
    flex: 1,
    minHeight: 320,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  saveButton: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 15 },
  savedWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
  dirtyBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.textPrimary,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    ...shadow.floating,
  },
  dirtyText: { color: colors.white, fontSize: 13, fontFamily: fonts.medium },
  dirtyBarButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  dirtyBarButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(58,46,48,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '86%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.floating },
  modalTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  modalLead: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  modalButton: { borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  modalPrimary: { backgroundColor: colors.primary },
  modalPrimaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  modalGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalGhostText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 13 },
});
