import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LiveMonitorScreen from '../screens/Shared/LiveMonitorScreen';
import TankDetailScreen from '../screens/Shared/TankDetailScreen';
import { stackHeaderOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function LiveMonitorStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
      <Stack.Screen name="LiveMonitorHome" component={LiveMonitorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TankDetail" component={TankDetailScreen} />
    </Stack.Navigator>
  );
}
