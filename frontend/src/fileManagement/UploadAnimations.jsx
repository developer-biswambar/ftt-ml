// src/components/UploadAnimations.jsx
import React from 'react';

export const UploadProgressIndicator = ({isUploading, fileName, progress = 0}) => {
    if (!isUploading) return null;

    return (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-blue-200 p-4 min-w-80">
            <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                        Uploading "{fileName}"
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{width: `${progress}%`}}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {progress}% complete
                    </div>
                </div>
            </div>
        </div>
    );
};

export const FileUploadSuccess = ({fileName, onClose, fileDetails}) => {
    React.useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-4 right-4 z-50 bg-green-50 rounded-lg shadow-lg border border-green-200 p-4 min-w-80">
            <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                </div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-green-900">
                        File uploaded successfully!
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                        "{fileName}" is now available
                    </div>
                    {fileDetails && (
                        <div className="text-xs text-green-600 mt-2 space-y-1">
                            <div>📊 {fileDetails.total_rows?.toLocaleString()} rows</div>
                            <div>📋 {fileDetails.columns?.length} columns</div>
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-green-400 hover:text-green-600 transition-colors"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export const NewFileIndicator = ({isNew, children}) => {
    return (
        <div className={`relative ${isNew ? 'animate-pulse' : ''}`}>
            {isNew && (
                <>
                    {/* Sparkle animation */}
                    <div className="absolute -top-1 -right-1 z-10">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-ping"></div>
                        <div className="absolute top-0 right-0 h-3 w-3 bg-green-600 rounded-full animate-pulse"></div>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-green-100 rounded-lg animate-pulse opacity-50"></div>
                </>
            )}
            <div
                className={`relative ${isNew ? 'bg-green-50 border-green-200 shadow-md' : ''} transition-all duration-500`}>
                {children}
                {isNew && (
                    <div className="absolute top-2 right-2 text-green-600 text-xs font-bold animate-bounce">
                        NEW ✨
                    </div>
                )}
            </div>
        </div>
    );
};

// Hook to manage upload notifications
export const useUploadNotifications = () => {
    const [notifications, setNotifications] = React.useState([]);

    const addNotification = React.useCallback((notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {...notification, id};
        setNotifications(prev => [...prev, newNotification]);

        // Auto remove after 4 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);

        return id;
    }, []);

    const removeNotification = React.useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return {
        notifications,
        addNotification,
        removeNotification
    };
};