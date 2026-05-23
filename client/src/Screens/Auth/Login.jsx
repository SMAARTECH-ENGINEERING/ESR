import { useNavigate } from "react-router-dom";
// import Tostify from "../Common/Tostify";
// import { toast } from "react-toastify";
// import lgnIllustrator from "../../Assets/Login/lgnIll.png";
// import logo from "../../Assets/Logos/AudizoneLogo.png";
import logo from "../../Assets/Logos/logo1.webp";
import lgnBg from "../../Assets/Login/bg.png";
import LeftSection from "../../Components/Login/LeftSection";

const Login = () => {
  let navigate = useNavigate();

  const handleLogin = async () => {
    navigate("/admin/dashboard");
  };

  // const goToSignUP = () => {
  //   navigate("/sign-up");
  // };

  // const tostifyErr = (msg) => {
  //   toast.error(msg, {
  //     position: "top-center",
  //     autoClose: 3000,
  //     hideProgressBar: false,
  //     closeOnClick: true,
  //     pauseOnHover: true,
  //     draggable: true,
  //     progress: undefined,
  //     theme: "colored",
  //   });
  // };

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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center">
              <input type="checkbox" id="remember" className="mr-2" />
              <label htmlFor="remember" className="text-sm text-gray-700">
                Remember Me !
              </label>
            </div>
            <button
              type="submit"
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-btnHover transition duration-200"
            >
              Log in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
