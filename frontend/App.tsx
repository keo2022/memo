import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import RootNavigator from './src/navigation/RootNavigator';
import NamePromptModal from './src/components/NamePromptModal';
import { loadEditorName, saveEditorName } from './src/lib/identity';
import { colors } from './src/theme';

// OTA 업데이트 확인: 새 버전이 올라와 있으면 받아서 바로 재시작한다.
// 개발 모드나 Expo Go에서는 동작하지 않으므로 조용히 건너뛴다.
async function checkForOtaUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // 네트워크 오류 등은 무시하고 기존 번들로 실행한다.
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
    Jua: require('./assets/fonts/Jua-Regular.ttf'),
  });

  const [identityChecked, setIdentityChecked] = useState(false);
  const [askName, setAskName] = useState(false);

  useEffect(() => {
    checkForOtaUpdate();
  }, []);

  useEffect(() => {
    loadEditorName().then((name) => {
      setAskName(!name);
      setIdentityChecked(true);
    });
  }, []);

  if (!fontsLoaded || !identityChecked) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNavigator />
        <NamePromptModal
          visible={askName}
          title="별명을 정해주세요"
          confirmLabel="시작"
          onClose={() => setAskName(false)}
          onConfirm={async (name) => {
            await saveEditorName(name);
            setAskName(false);
          }}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
