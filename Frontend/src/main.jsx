import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { WebSocketProvider } from "./context/WebSocketContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import "./index.css";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <WebSocketProvider>
                    <ConfirmProvider>
                        <App />
                    </ConfirmProvider>
                </WebSocketProvider>
            </AuthProvider>
        </ThemeProvider>
    </React.StrictMode>
);
