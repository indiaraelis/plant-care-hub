// frontend/src/components/Layout.js
import React from 'react';
import { ToastContainer } from 'react-toastify';

function Layout({ children }) {
  return (
    <>
      <div className="main-app-content"> {/* Add a wrapper for your content */}
        {children}
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}

export default Layout;