import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ReportsScreen from '../screens/Shared/ReportsScreen';
import { stackHeaderOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={stackHeaderOptions}>
      <Stack.Screen name="ReportsHome" component={ReportsScreen} options={{ title: 'Reports' }} />
    </Stack.Navigator>
  );
}
