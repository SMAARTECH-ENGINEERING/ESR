import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import LoadingState from '../components/common/LoadingState';
import AuthStack from './AuthStack';
import AdminTabs from './AdminTabs';
import ControlRoomTabs from './ControlRoomTabs';

export default function RootNavigator() {
  const { isAuthenticated, isBootstrapping, role } = useAuth();

  if (isBootstrapping) {
    return <LoadingState message="Starting up..." />;
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : role === 'admin' ? (
        <AdminTabs />
      ) : (
        <ControlRoomTabs />
      )}
    </NavigationContainer>
  );
}
