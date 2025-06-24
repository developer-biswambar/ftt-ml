// src/pages/ViewerPage.jsx - Full page viewer component
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DataViewer from '../components/DataViewer';
import { AlertCircle } from 'lucide-react';

const ViewerPage = () => {
    const { fileId } = useParams();
    const [error, setError] = useState(null);

    useEffect(() => {
        // Set document title
        document.title = 'Data Viewer - Financial Reconciliation';

        // Validate fileId
        if (!fileId) {
            setError('No file ID provided');
        }

        // Cleanup on unmount
        return () => {
            document.title = 'Financial Reconciliation Chat';
        };
    }, [fileId]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        );
    }

    return <DataViewer fileId={fileId} />;
};

export default ViewerPage;