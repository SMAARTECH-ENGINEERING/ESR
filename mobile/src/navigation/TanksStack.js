import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TankListScreen from '../screens/Admin/TankListScreen';
import TankDetailScreen from '../screens/Shared/TankDetailScreen';
import TankFormScreen from '../screens/Admin/TankFormScreen';
import { stackHeaderOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function TanksStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
      <Stack.Screen name="TankListHome" component={TankListScreen} options={{ title: 'Tanks' }} />
      <Stack.Screen name="TankDetail" component={TankDetailScreen} />
      <Stack.Screen name="TankForm" component={TankFormScreen} />
    </Stack.Navigator>
  );
}
