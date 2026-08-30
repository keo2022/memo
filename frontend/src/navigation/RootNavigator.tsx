import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SheetListScreen from '../screens/SheetListScreen';
import TabListScreen from '../screens/TabListScreen';
import TabDetailScreen from '../screens/TabDetailScreen';
import { colors, fonts } from '../theme';

export type RootStackParamList = {
  SheetList: undefined;
  TabList: { sheetId: string; sheetName: string };
  TabDetail: { sheetId: string; sheetName: string; tabId?: string; tabName?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="SheetList"
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 17 },
          headerTintColor: colors.primaryDark,
          headerBackTitleVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="SheetList" component={SheetListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TabList" component={TabListScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="TabDetail"
          component={TabDetailScreen}
          options={({ route }) => ({ title: route.params.tabName ?? route.params.sheetName })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
