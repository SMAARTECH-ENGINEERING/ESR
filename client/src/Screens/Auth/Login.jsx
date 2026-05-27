import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../Assets/Logos/logo1.webp";
import lgnBg from "../../Assets/Login/bg.png";
import LeftSection from "../../Components/Login/LeftSection";

import api from "../../utils/api";
import { encryptData } from "../localStorageUtils";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle Input Change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      console.log("SUCCESS", response.data);

      if (response.data?.data?.token) {
        encryptData(response.data.data);
        // Redirect to role-appropriate home screen
        const role = response.data.data.user?.role;
        navigate(role === 'control_room' ? '/admin/report' : '/admin/dashboard');
      } else {
        setError("Invalid response from server. Please try again.");
      }
    } catch (error) {
      console.log("Login Error:", error);
      setError(error.response?.data?.message || error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left Side */}
      <LeftSection logo={logo} />

      {/* Right Side */}
      <div
        className="flex justify-center items-center p-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${lgnBg})` }}
      >
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <h2 className="text-xl font-semibold mb-1">Welcome to our CRM</h2>

          <h3 className="text-2xl font-bold mb-4">Log In Now</h3>

          <p className="text-gray-500 mb-6">
            Enter your details to proceed further
          </p>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 text-red-600 px-4 py-2 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Password */}
            <div>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Remember */}
            <div className="flex items-center">
              <input type="checkbox" id="remember" className="mr-2" />

              <label htmlFor="remember" className="text-sm text-gray-700">
                Remember Me
              </label>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-btnHover transition duration-200"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
