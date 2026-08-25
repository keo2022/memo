import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenuListScreen from '../screens/MenuListScreen';
import SheetListScreen from '../screens/SheetListScreen';
import SheetDetailScreen from '../screens/SheetDetailScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  MenuList: undefined;
  SheetList: { menuId: string; menuName: string };
  SheetDetail: { sheetId: string; sheetName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="MenuList"
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
          headerTintColor: colors.primary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MenuList" component={MenuListScreen} options={{ title: '메뉴' }} />
        <Stack.Screen
          name="SheetList"
          component={SheetListScreen}
          options={({ route }) => ({ title: route.params.menuName })}
        />
        <Stack.Screen
          name="SheetDetail"
          component={SheetDetailScreen}
          options={({ route }) => ({ title: route.params.sheetName })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
