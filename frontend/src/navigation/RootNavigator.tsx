import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenuListScreen from '../screens/MenuListScreen';
import SheetListScreen from '../screens/SheetListScreen';
import SheetDetailScreen from '../screens/SheetDetailScreen';

export type RootStackParamList = {
  MenuList: undefined;
  SheetList: { menuId: string; menuName: string };
  SheetDetail: { sheetId: string; sheetName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MenuList">
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
