'use client';
import { UploadButton } from '../utils/uploadthing';
import { useState } from 'react';

export default function ResumeUpload() {
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingInfo, setProcessingInfo] = useState(null);
  const [userName, setUserName] = useState('');
  const [savedRecord, setSavedRecord] = useState(null);

  const processResumeFromUrl = async (fileUrl, fileName) => {
    setProcessing(true);
    setError(null);
    setSummary(null);
    setSavedRecord(null);
    setProcessingInfo('Processing uploaded resume...');

    try {
      console.log('=== FRONTEND DEBUG ===');
      console.log('Processing file URL:', fileUrl);
      console.log('File name:', fileName);
      console.log('User name:', userName);
      
      // Make the API call with file URL
      const response = await fetch('/api/process-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl: fileUrl,
          fileName: fileName,
          userName: userName || fileName.replace(/\.[^/.]+$/, "") // Use filename without extension as fallback
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `Server error: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
        }
      }

      // Parse the response
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error('Invalid response from server');
      }

      console.log('Parsed result:', result);
      
      // Check for errors in the result
      if (result.error) {
        throw new Error(result.error);
      }

      // Check for success and summary
      if (result.success && result.summary) {
        setSummary(result.summary);
        setSavedRecord(result.data?.savedRecord);
        setProcessingInfo(null);
        console.log('Resume analysis completed successfully');
        console.log('Saved record:', result.data?.savedRecord);
      } else {
        throw new Error('Invalid response format: missing summary');
      }

    } catch (err) {
      console.error('=== FRONTEND ERROR ===');
      console.error('Error details:', err);
      console.error('Error stack:', err.stack);
      
      setError(err.message || 'Failed to process resume. Please try again.');
      setProcessingInfo(null);
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setUploadedFile(null);
    setSummary(null);
    setError(null);
    setProcessing(false);
    setProcessingInfo(null);
    setUserName('');
    setSavedRecord(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        Resume Analyzer
      </h1>
      
      <div className="space-y-6">
        {/* User Name Input */}
        <div className="space-y-2">
          <label htmlFor="userName" className="block text-sm font-medium text-gray-700">
            Your Name (Optional)
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={processing}
          />
          <p className="text-xs text-gray-500">
            If not provided, we will use your filename as the name
          </p>
        </div>

        {/* File Upload Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <div className="space-y-4">
            <div className="text-gray-600">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            {!uploadedFile ? (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Upload your resume for analysis
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  PDF, DOC, or DOCX files up to 16MB
                </p>
                
                <UploadButton
                  endpoint="documentUploader"
                  onClientUploadComplete={(res) => {
                    console.log("Upload completed:", res);
                    const file = res[0];
                    setUploadedFile({
                      url: file.serverData.fileUrl,
                      name: file.name,
                      size: file.size
                    });
                    setError(null);
                    console.log("File uploaded successfully:", file.serverData.fileUrl);
                  }}
                  onUploadError={(error) => {
                    console.error("Upload error:", error);
                    setError(`Upload failed: ${error.message}`);
                  }}
                  onUploadBegin={(name) => {
                    console.log("Upload began for:", name);
                    setProcessingInfo('Uploading file...');
                  }}
                  onUploadProgress={(progress) => {
                    setProcessingInfo(`Uploading... ${progress}%`);
                  }}
                  appearance={{
                    button: "bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors",
                    allowedContent: "text-gray-500 text-sm mt-2"
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-sm text-green-600 font-medium">
                    ✓ {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={resetForm}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
                
                {/* Process Button */}
                <button
                  onClick={() => processResumeFromUrl(uploadedFile.url, uploadedFile.name)}
                  disabled={processing}
                  className={`px-8 py-3 rounded-md font-medium text-white transition-colors ${
                    processing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                  }`}
                >
                  {processing ? 'Analyzing & Saving...' : 'Analyze Resume'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Info */}
        {processingInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">{processingInfo}</p>
              </div>
            </div>
          </div>
        )}

        {/* Database Save Success Info */}
        {savedRecord && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  Resume saved successfully! Record ID: {savedRecord.id}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Saved at: {new Date(savedRecord.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {summary && (
          <div className="bg-green-50 border border-green-200 rounded-md p-6">
            <h2 className="text-lg font-semibold text-green-800 mb-4">Resume Analysis Complete</h2>
            <div className="prose max-w-none">
              <div className="bg-white p-4 rounded border shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {summary}
                </pre>
              </div>
            </div>
          </div>
        )}


        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-md">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Debug Info:</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <div>API Endpoint: /api/process-resume</div>
              <div>Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
              <div>Uploaded File: {uploadedFile ? `${uploadedFile.name} (${uploadedFile.url})` : 'None'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}