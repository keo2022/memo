import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import SheetListScreen from '../screens/SheetListScreen';
import TabListScreen from '../screens/TabListScreen';
import TabDetailScreen from '../screens/TabDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import MemoListScreen from '../screens/MemoListScreen';
import MemoDetailScreen from '../screens/MemoDetailScreen';
import { colors, fonts } from '../theme';

// 엑셀(스프레드시트) 탭 안의 화면들
export type ExcelStackParamList = {
  SheetList: undefined;
  TabList: { sheetId: string; sheetName: string };
  TabDetail: { sheetId: string; sheetName: string; tabId?: string; tabName?: string };
};

// 메모 탭 안의 화면들
export type MemoStackParamList = {
  MemoList: undefined;
  MemoDetail: { memoId: string; memoTitle: string };
};

// 예전 코드가 참조하던 이름 유지 (엑셀 탭 스택과 동일)
export type RootStackParamList = ExcelStackParamList;

export type RootTabParamList = {
  Memo: undefined;
  Home: undefined;
  Excel: undefined;
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
  },
};

const stackScreenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 17 },
  headerTintColor: colors.primaryDark,
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

const ExcelStackNav = createNativeStackNavigator<ExcelStackParamList>();
function ExcelStack() {
  return (
    <ExcelStackNav.Navigator initialRouteName="SheetList" screenOptions={stackScreenOptions}>
      <ExcelStackNav.Screen name="SheetList" component={SheetListScreen} options={{ headerShown: false }} />
      <ExcelStackNav.Screen name="TabList" component={TabListScreen} options={{ headerShown: false }} />
      <ExcelStackNav.Screen
        name="TabDetail"
        component={TabDetailScreen}
        options={({ route }) => ({ title: route.params.tabName ?? route.params.sheetName })}
      />
    </ExcelStackNav.Navigator>
  );
}

const MemoStackNav = createNativeStackNavigator<MemoStackParamList>();
function MemoStack() {
  return (
    <MemoStackNav.Navigator initialRouteName="MemoList" screenOptions={stackScreenOptions}>
      <MemoStackNav.Screen name="MemoList" component={MemoListScreen} options={{ headerShown: false }} />
      <MemoStackNav.Screen
        name="MemoDetail"
        component={MemoDetailScreen}
        options={({ route }) => ({ title: route.params.memoTitle })}
      />
    </MemoStackNav.Navigator>
  );
}

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Memo: { active: 'document-text', inactive: 'document-text-outline' },
  Home: { active: 'heart', inactive: 'heart-outline' },
  Excel: { active: 'grid', inactive: 'grid-outline' },
};

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  Memo: '메모',
  Home: '메인',
  Excel: '엑셀',
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primaryDark,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 84 : 62,
            paddingTop: 6,
          },
          tabBarLabel: TAB_LABELS[route.name],
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS[route.name].active : TAB_ICONS[route.name].inactive}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Memo" component={MemoStack} />
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Excel" component={ExcelStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
