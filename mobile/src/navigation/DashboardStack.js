import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/Admin/DashboardScreen';
import TankDetailScreen from '../screens/Shared/TankDetailScreen';
import TankFormScreen from '../screens/Admin/TankFormScreen';
import { stackHeaderOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="TankDetail" component={TankDetailScreen} />
      <Stack.Screen name="TankForm" component={TankFormScreen} />
    </Stack.Navigator>
  );
}
