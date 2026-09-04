import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import NamePromptModal from './src/components/NamePromptModal';
import { loadEditorName, saveEditorName } from './src/lib/identity';
import { colors } from './src/theme';

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
          title="이름을 알려주세요"
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
