'use client';
import { UploadButton } from '../utils/uploadthing';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { jsPDF } from 'jspdf';

export default function ResumeUpload() {
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingInfo, setProcessingInfo] = useState(null);
  const [userName, setUserName] = useState('');
  const [savedRecord, setSavedRecord] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const summaryRef = useRef(null);

  const processResumeFromUrl = async (fileUrl, fileName) => {
    setProcessing(true);
    setError(null);
    setSummary(null);
    setSavedRecord(null);
    setProcessingInfo('Processing uploaded resume...');

    try {
      const response = await fetch('/api/process-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl: fileUrl,
          fileName: fileName,
          userName: userName || fileName.replace(/\.[^/.]+$/, "")
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `Server error: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
        }
      }

      const result = await response.json();
      
      if (!result.success || !result.summary) {
        throw new Error('Invalid response format: missing summary');
      }

      setSummary(result.summary);
      setSavedRecord(result.data?.savedRecord);
      setProcessingInfo(null);
    } catch (err) {
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
    setPreviewError(null);
  };

  const downloadSummaryAsPDF = () => {
    if (!summary) return;

    const pdf = new jsPDF();
    
    // Set document properties
    pdf.setProperties({
      title: 'Resume Summary',
      subject: 'Professional resume analysis',
      author: userName || 'Resume Summary Generator',
    });

    // Add title
    pdf.setFontSize(18);
    pdf.setTextColor(40);
    pdf.text('Resume Summary', 105, 20, { align: 'center' });
    
    // Add subtitle with date
    pdf.setFontSize(12);
    pdf.setTextColor(100);
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    // Add divider line
    pdf.setDrawColor(200);
    pdf.line(20, 32, 190, 32);
    
    // Add summary content with proper formatting
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    
    // Split the summary into lines that fit the page width
    const splitText = pdf.splitTextToSize(summary, 170);
    
    // Add text with proper line spacing
    pdf.text(splitText, 20, 40, {
      maxWidth: 170,
      lineHeightFactor: 1.5
    });
    
    // Save the PDF
    pdf.save(`${userName || 'resume'}-summary.pdf`);
  };

  const copySummaryToClipboard = () => {
    navigator.clipboard.writeText(summary)
      .then(() => {
        alert('Summary copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  };

  const renderFilePreview = () => {
    if (!uploadedFile) return null;

    const fileType = uploadedFile.name.split('.').pop().toLowerCase();
    const isPDF = fileType === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileType);
    const isWord = ['doc', 'docx'].includes(fileType);

    if (isPDF) {
      return (
        <iframe 
          src={uploadedFile.url}
          className="w-full h-full border border-gray-200 rounded"
          title="Uploaded Resume"
          onLoad={() => setPreviewLoading(false)}
          onError={() => {
            setPreviewLoading(false);
            setPreviewError('Failed to load PDF preview');
          }}
        />
      );
    }

    if (isWord) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Word document preview not available in browser</p>
            <a 
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedFile.url)}&embedded=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View with Google Docs
            </a>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full">
          <Image 
            width={800}
            height={600}
            src={uploadedFile.url}
            alt="Uploaded resume"
            className="max-w-full max-h-full object-contain"
            onLoad={() => setPreviewLoading(false)}
            onError={() => {
              setPreviewLoading(false);
              setPreviewError('Failed to load image preview');
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="https://gojf7j54p4.ufs.sh/f/CcC11ljtXd0c5L0Ch2EoHV6KuzLAEMekUxlpn9y4f2c7sGdB"
              alt="SnapSum Logo"
              width={220}
              height={220}
              className="rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">
            Resume <span className="text-indigo-600">Summary</span> Generator
          </h1>
          <p className="text-gray-600 mt-1">
            Upload your resume and get an instant professional summary
          </p>
        </div>

        {/* Main Content Area */}
        {!summary ? (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            {/* Upload Section */}
            <div className="p-6 sm:p-8">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    disabled={processing}
                  />
                  <p className="text-xs text-gray-500">
                    If not provided, we will use your filename
                  </p>
                </div>

                {/* File Upload Section */}
                <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  uploadedFile ? 'border-green-300 bg-green-50' : 'border-gray-300'
                }`}>
                  <div className="space-y-4">
                    {!uploadedFile ? (
                      <>
                        <div className="mx-auto h-16 w-16 text-gray-400">
                          <svg stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xl font-medium text-gray-900 mb-2 ">
                            Upload your resume
                          </p>
                          <p className="text-sm text-gray-500 mb-6">
                            PDF, DOC, or DOCX files up to 16MB
                          </p>
                          
                          <UploadButton
                            endpoint="documentUploader"
                            onClientUploadComplete={(res) => {
                              const file = res[0];
                              setUploadedFile({
                                url: file.serverData.fileUrl,
                                name: file.name,
                                size: file.size,
                                type: file.type
                              });
                              setError(null);
                              setPreviewLoading(true);
                              setProcessingInfo(null);
                            }}
                            onUploadError={(error) => {
                              setError(`Upload failed: ${error.message}`);
                              setProcessingInfo(null);
                            }}
                            onUploadBegin={() => {
                              setProcessingInfo('Uploading file...');
                            }}
                            onUploadProgress={(progress) => {
                              setProcessingInfo(`Uploading... ${progress}%`);
                            }}
                            appearance={{
                              button: "bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-colors text-base shadow-md hover:shadow-lg",
                              allowedContent: "text-gray-500 text-sm mt-2"
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center space-x-3">
                          <span className="text-green-600 font-medium flex items-center text-sm">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                          <button
                            onClick={resetForm}
                            className="text-sm text-gray-500 hover:text-gray-700 transition underline"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <button
                          onClick={() => processResumeFromUrl(uploadedFile.url, uploadedFile.name)}
                          disabled={processing}
                          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors flex items-center justify-center shadow-md hover:shadow-lg ${
                            processing
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {processing ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                              </svg>
                              Analyze Resume
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Messages */}
            <div className="px-6 pb-6 sm:px-8 space-y-3">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {processingInfo && (
                <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 rounded flex items-center">
                  <svg className="animate-spin h-5 w-5 text-indigo-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-indigo-700">{processingInfo}</p>
                </div>
              )}

              {savedRecord && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        Resume saved successfully! ID: {savedRecord.id}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            {/* Split View Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                <svg className="w-5 h-5 inline-block mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Resume Analysis Results
              </h2>
              <div className="flex space-x-2">
                <button 
                  onClick={downloadSummaryAsPDF}
                  className="text-sm text-indigo-600 hover:text-indigo-800 transition flex items-center px-3 py-1 border border-indigo-200 rounded-md bg-indigo-50 hover:bg-indigo-100"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Download PDF
                </button>
                <button 
                  onClick={copySummaryToClipboard}
                  className="text-sm text-green-600 hover:text-green-800 transition flex items-center px-3 py-1 border border-green-200 rounded-md bg-green-50 hover:bg-green-100"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                  </svg>
                  Copy 
                </button>
                <button 
                  onClick={resetForm}
                  className="text-sm text-gray-600 hover:text-gray-800 transition flex items-center px-3 py-1 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  New Upload
                </button>
              </div>
            </div>

            {/* 50/50 Split View */}
            <div className="flex flex-col md:flex-row">
              {/* Left Side - Uploaded Resume */}
              <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-gray-200">
                <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Uploaded Resume: {uploadedFile.name}
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-auto relative">
                  {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
                      <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  {previewError ? (
                    <div className="flex items-center justify-center h-full text-red-500">
                      <p>{previewError}</p>
                    </div>
                  ) : (
                    renderFilePreview()
                  )}
                </div>
              </div>

              {/* Right Side - Summary */}
              <div className="w-full md:w-1/2 p-6">
                <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Generated Summary
                </h3>
                <div 
                  ref={summaryRef}
                  className="bg-gray-50 rounded-lg p-4 h-96 overflow-auto border border-gray-200"
                >
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                    {summary}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Resume Summary Generator. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}