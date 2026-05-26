import React from 'react';
import { Navigate } from 'react-router-dom';
import { decryptData } from '../../Screens/localStorageUtils';

const AuthLayout = ({ children }) => {
  const userData = decryptData();
  if (!userData?.token) {
    return <Navigate to="/" replace />;
  }
  return <React.Fragment>{children}</React.Fragment>;
};

export default AuthLayout;
