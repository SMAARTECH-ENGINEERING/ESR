import React, { useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Tostify = (props) => {
    // useEffect(() => {
    //     if (props.tostifyErr === true) {
    //         notify();
    //         return
    //     } else {
    //         return
    //     }
    // }, [props.tostifyErr])

    // const notify = () => toast.error('🦄 Wow so easy!', {
    //     position: "top-center",
    //     autoClose: 3000,
    //     hideProgressBar: false,
    //     closeOnClick: true,
    //     pauseOnHover: true,
    //     draggable: true,
    //     progress: undefined,
    //     theme: "light",
    // });
    return (
        <React.Fragment>
            <ToastContainer
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />
        </React.Fragment>
    )
}

export default Tostify
