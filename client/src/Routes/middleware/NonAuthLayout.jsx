import React from 'react'
import { Navigate } from 'react-router-dom';
import { decryptData } from '../../Screens/localStorageUtils';

const NonAuthLayout = (props) => {
  const userData = decryptData();
  
  // If user is already logged in, redirect to dashboard
  if (userData?.token) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return (
    <React.Fragment>
      {props.children}
    </React.Fragment>
  )
}

export default NonAuthLayout