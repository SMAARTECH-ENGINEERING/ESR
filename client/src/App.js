import React from 'react'
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { authRoutes, userRoutes } from './Routes/AllRoutes';
import NonAuthLayout from './Routes/middleware/NonAuthLayout';
import AuthLayout from './Routes/middleware/AuthLayout';
import Layout from './Screens/Layout/Layout';
import NotFound from './Screens/404';
import "sweetalert2/dist/sweetalert2.min.css";

const App = () => {
  return (
    <React.Fragment>
      <BrowserRouter>
        <Routes>
          {authRoutes.map((route, idx) => (
            <Route
              path={route.path}
              element={<NonAuthLayout>{route.component}</NonAuthLayout>}
              key={idx}
            />
          ))}

          {userRoutes.map((route, idx) => (
            <Route
              path={route.path}
              element={
                <AuthLayout>
                  <Layout>
                    {route.component}
                  </Layout>
                </AuthLayout>
              }
              key={idx}
            />
          ))}

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </React.Fragment>
  )
}

export default App
