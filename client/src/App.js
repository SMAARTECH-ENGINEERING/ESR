import React from 'react'
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { authRoutes, userRoutes } from './Routes/AllRoutes';
import NonAuthLayout from './Routes/middleware/NonAuthLayout';
import AuthLayout    from './Routes/middleware/AuthLayout';
import RoleGuard     from './Routes/middleware/RoleGuard';
import Layout        from './Screens/Layout/Layout';
import NotFound      from './Screens/404';
import "sweetalert2/dist/sweetalert2.min.css";

const App = () => {
  return (
    <React.Fragment>
      <BrowserRouter>
        <Routes>
          {/* Public routes — no auth required */}
          {authRoutes.map((route, idx) => (
            <Route
              key={idx}
              path={route.path}
              element={<NonAuthLayout>{route.component}</NonAuthLayout>}
            />
          ))}

          {/* Protected routes — must be logged in AND have the right role */}
          {userRoutes.map((route, idx) => (
            <Route
              key={idx}
              path={route.path}
              element={
                <AuthLayout>
                  <RoleGuard roles={route.roles}>
                    <Layout>
                      {route.component}
                    </Layout>
                  </RoleGuard>
                </AuthLayout>
              }
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
