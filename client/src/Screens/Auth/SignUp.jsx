import React from 'react';
import { useNavigate } from "react-router-dom";
// import './signUp.css';

const SignUp = () => {
    let navigate = useNavigate();

    const goToLogin = () => {
        navigate('/login');
    }

    const signupBackImg = 'https://applescoop.org/image/wallpapers/mac/gorgeous-hyper-realistic-painting-of-a-peaceful-nature-landscape-8k-best-most-popular-free-download-wallpapers-for-macbook-pro-and-macbook-air-and-microsoft-windows-desktop-pcs-4k-07-12-2024-1733638449-hd-wallpaper.png';

    return (
        <div>
            <div
                style={{ backgroundImage: `url(${signupBackImg})` }}
                className="bg-cover bg-center h-screen">
                <div className="container mx-auto h-full">
                    <div className="flex content-center items-center justify-center h-full ">
                        <div className="w-full lg:w-5/12 ">
                            <div className="max-h-[32rem] flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-2xl bg-white border-0 pl-6 pr-4 pt-8 pb-12">

                                <div className="btn-wrapper text-center">
                                    <div className="text-xl text-[#2b2f32] font-bold text-black">Create an Account</div>
                                </div>

                                <div className="flex-auto mt-2">
                                    <div className='text-md text-center mb-7'>
                                        <span className='text-[#718092]'>
                                            Already have an account?
                                        </span>&nbsp;
                                        <span
                                            onClick={goToLogin}
                                            className='text-[#2E3A8C] hover:text-[#f95e01] transition ease-in-out hover:duration-300 font-medium cursor-pointer hover:underline'>
                                            Log In
                                        </span>
                                    </div>

                                    <div className='overflow-y-auto max-h-[23rem] px-6'>
                                        <div className="relative w-full mb-3">
                                            <div className='text-[#132c4a] block text-sm mb-2'>
                                                Name
                                                <span className='text-red-600 text-lg'> *</span>
                                            </div>
                                            <input
                                                type="text"
                                                className="text-[#132c4a] border-0 px-3 py-3 placeholder-[#718092] text-[#132c4a] bg-white rounded text-sm shadow focus:outline-none focus:ring-1 ring-[#2E3A8C] w-full ease-linear transition-all duration-150"
                                                placeholder="Your name"
                                            />
                                        </div>

                                        <div className="relative w-full mb-3">
                                            <div className='text-[#132c4a] block text-sm mb-2'>
                                                E-Mail
                                                <span className='text-red-600 text-lg'> *</span>
                                            </div>
                                            <input
                                                type="text"
                                                className="text-[#132c4a] border-0 px-3 py-3 placeholder-[#718092] text-[#132c4a] bg-white rounded text-sm shadow focus:outline-none focus:ring-1 ring-[#2E3A8C] w-full ease-linear transition-all duration-150"
                                                placeholder="Your E-mail id"
                                            />
                                        </div>

                                        <div className="relative w-full mb-3">
                                            <div className='text-[#132c4a] block text-sm mb-2'>
                                                Mobile Number
                                                <span className='text-red-600 text-lg'> *</span>
                                            </div>
                                            <input
                                                type="text"
                                                className="text-[#132c4a] border-0 px-3 py-3 placeholder-[#718092] text-[#132c4a] bg-white rounded text-sm shadow focus:outline-none focus:ring-1 ring-[#2E3A8C] w-full ease-linear transition-all duration-150"
                                                placeholder="Your Phone number"
                                            />
                                        </div>

                                        <div className="relative w-full mb-3">
                                            <div className='text-[#132c4a] block text-sm mb-2'>
                                                Password
                                                <span className='text-red-600 text-lg'> *</span>
                                            </div>
                                            <input
                                                type="password"
                                                className="text-[#132c4a] border-0 px-3 py-3 placeholder-[#718092] text-[#132c4a] bg-white rounded text-sm shadow focus:outline-none focus:ring-1 ring-[#2E3A8C] w-full ease-linear transition-all duration-150"
                                                placeholder="Password"
                                            />
                                        </div>

                                        <div className="relative w-full mb-5">
                                            <div className='text-[#132c4a] block text-sm mb-2'>
                                                Address
                                                <span className='text-red-600 text-lg'> *</span>
                                            </div>
                                            <textarea
                                                className="text-[#132c4a] border-0 px-3 py-3 placeholder-[#718092] text-[#132c4a] bg-white rounded text-sm shadow focus:outline-none focus:ring-1 ring-[#2E3A8C] w-full ease-linear transition-all duration-150"
                                                placeholder="Your address"
                                            ></textarea>
                                        </div>

                                        <div className="inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                class="border-[#132c4a] rounded h-5 w-5 mr-2" />

                                            <span className='text-[#132c4a] block text-sm'>
                                                I hearby accept the T&C PKM
                                            </span>
                                        </div>

                                        <div className='w-full flex items-center justify-center mt-5'>
                                            <button
                                                className='h-12 w-4/5 text-lg font-semibold text-white bg-[#2E3A8C] hover:bg-[#f95e01] transition ease-in-out hover:duration-300 rounded-xl shadow-lg shadow-[#ffdcc7]'>
                                                Sign Up
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>




            </div>
        </div>
    )
}

export default SignUp
