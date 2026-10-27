/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        variant: "danger", // "danger" | "warning" | "info"
        notice: null,
    });

    const resolverRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialogState({
                isOpen: true,
                title: options.title || "Confirm Action",
                message: options.message || "Are you sure you want to proceed?",
                confirmText: options.confirmText || "Confirm",
                cancelText: options.cancelText || "Cancel",
                variant: options.variant || "danger",
                notice: options.notice || null,
            });
        });
    }, []);

    const handleConfirm = () => {
        if (resolverRef.current) {
            resolverRef.current(true);
            resolverRef.current = null;
        }
        setDialogState((prev) => ({ ...prev, isOpen: false }));
    };

    const handleCancel = () => {
        if (resolverRef.current) {
            resolverRef.current(false);
            resolverRef.current = null;
        }
        setDialogState((prev) => ({ ...prev, isOpen: false }));
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && dialogState.isOpen) {
                handleCancel();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [dialogState.isOpen]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}

            {dialogState.isOpen && (
                <div
                    className="confirm-modal-overlay"
                    onClick={handleCancel}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-modal-title"
                >
                    <div
                        className="confirm-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="confirm-modal-close-btn"
                            aria-label="Close dialog"
                        >
                            <X size={18} />
                        </button>

                        <div className="confirm-modal-header">
                            <div className={`confirm-modal-icon-badge confirm-modal-icon-${dialogState.variant}`}>
                                {dialogState.variant === "danger" ? (
                                    <AlertTriangle size={22} />
                                ) : dialogState.variant === "warning" ? (
                                    <AlertCircle size={22} />
                                ) : (
                                    <Info size={22} />
                                )}
                            </div>

                            <div style={{ flex: 1, paddingRight: "18px" }}>
                                <h3 id="confirm-modal-title" className="confirm-modal-title">
                                    {dialogState.title}
                                </h3>
                                <p className="confirm-modal-message">
                                    {dialogState.message}
                                </p>

                                {dialogState.notice && (
                                    <div className="confirm-modal-notice-box">
                                        <Info size={15} style={{ flexShrink: 0, marginTop: "2px", color: "var(--primary)" }} />
                                        <span>{dialogState.notice}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="confirm-modal-footer">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn-secondary"
                                style={{ padding: "8px 18px", fontSize: "13.5px" }}
                            >
                                {dialogState.cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className={`btn ${dialogState.variant === "danger" ? "confirm-btn-danger" : "btn-primary"}`}
                                style={{ padding: "8px 20px", fontSize: "13.5px", fontWeight: 600 }}
                                autoFocus
                            >
                                {dialogState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context;
}

export default useConfirm;
