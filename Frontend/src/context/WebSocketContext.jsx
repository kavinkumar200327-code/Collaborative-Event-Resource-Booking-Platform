import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [latestMessage, setLatestMessage] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const reconnectTimeoutRef = useRef(null);

    const connect = useCallback(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        // Determine WS URL from window.location or fallback
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname || "127.0.0.1";
        const wsUrl = `${protocol}//${host}:8000/api/v1/ws?token=${token}`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    setLatestMessage(parsed);

                    // Show toast for notifications or updates
                    if (parsed.type === "notification" || parsed.title || parsed.message) {
                        setToastMessage({
                            title: parsed.title || "New Notification",
                            message: parsed.message || parsed.content || JSON.stringify(parsed),
                            type: parsed.notification_type || "info",
                            timestamp: new Date().toLocaleTimeString(),
                        });
                        setTimeout(() => setToastMessage(null), 5000);
                    }
                } catch {
                    if (event.data === "pong") {
                        // Keep alive response
                    }
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                setSocket(null);
                // Try reconnect in 4 seconds if still authenticated
                if (localStorage.getItem("access_token")) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, 4000);
                }
            };

            ws.onerror = () => {
                ws.close();
            };

            setSocket(ws);
        } catch (err) {
            console.warn("WebSocket connection failed:", err);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            connect();
        } else {
            if (socket) {
                socket.close();
            }
            setIsConnected(false);
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socket) {
                socket.close();
            }
        };
    }, [isAuthenticated, connect]);

    // Keepalive ping every 30s
    useEffect(() => {
        if (!socket || !isConnected) return;
        const interval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send("ping");
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [socket, isConnected]);

    const sendMessage = useCallback((msg) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
    }, [socket]);

    return (
        <WebSocketContext.Provider value={{ isConnected, latestMessage, sendMessage, toastMessage, clearToast: () => setToastMessage(null) }}>
            {children}
            {toastMessage && (
                <div style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    zIndex: 9999,
                    backgroundColor: "#1e293b",
                    color: "#fff",
                    padding: "14px 20px",
                    borderRadius: "10px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                    borderLeft: "5px solid #3b82f6",
                    maxWidth: "360px",
                    animation: "fadeIn 0.3s ease-in-out",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "#60a5fa" }}>🔔 {toastMessage.title}</strong>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{toastMessage.timestamp}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.4", color: "#cbd5e1" }}>{toastMessage.message}</p>
                </div>
            )}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket() {
    return useContext(WebSocketContext);
}

export default WebSocketContext;
