// src/pages/ViewerPage.jsx - Full page viewer component with enhanced title handling
import React, {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import DataViewer from '../components/viewer/DataViewer.jsx';
import {AlertCircle} from 'lucide-react';
import {apiService} from '../services/defaultApi.js';

const ViewerPage = () => {
    const {fileId} = useParams();
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');

    useEffect(() => {
        // Validate fileId
        if (!fileId) {
            setError('No file ID provided');
            return;
        }

        // Load file info for title
        const loadFileInfo = async () => {
            try {
                const response = await apiService.getFileInfo(fileId);
                if (response.success) {
                    setFileName(response.data.filename);
                    document.title = `Data Viewer - ${response.data.filename}`;
                } else {
                    document.title = 'Data Viewer - Financial Reconciliation';
                }
            } catch (err) {
                console.error('Failed to load file info:', err);
                document.title = 'Data Viewer - Financial Reconciliation';
            }
        };

        loadFileInfo();

        // Cleanup on unmount
        return () => {
            document.title = 'Financial Reconciliation Chat';
        };
    }, [fileId]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md mx-auto p-8">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4"/>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading File</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <div className="space-y-2">
                        <button
                            onClick={() => window.history.back()}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => window.close()}
                            className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                        >
                            Close Window
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <DataViewer fileId={fileId}/>;
};

export default ViewerPage;