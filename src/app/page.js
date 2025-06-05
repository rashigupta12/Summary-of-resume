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
  const [isDragOver, setIsDragOver] = useState(false);
  const summaryRef = useRef(null);
  const fileInputRef = useRef(null);

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
    setIsDragOver(false);
  };

  const handleFileSelect = (file) => {
    setUploadedFile({
      url: file.serverData.fileUrl,
      name: file.name,
      size: file.size,
      type: file.type
    });
    setError(null);
    setPreviewLoading(true);
    setProcessingInfo(null);
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF, DOC, or DOCX file.');
        return;
      }

      if (file.size > 16 * 1024 * 1024) { // 16MB limit
        setError('File size must be less than 16MB.');
        return;
      }

      // Trigger the upload button functionality
      // This is a workaround since we can't directly use the UploadThing API
      setProcessingInfo('Please use the upload button to complete the upload process.');
    }
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
          className="w-full h-full border border-gray-200 rounded-lg"
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
        <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-2">Word Document</p>
            <p className="text-gray-500 text-sm mb-4">Preview not available in browser</p>
            <a 
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedFile.url)}&embedded=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              View with Google Docs
            </a>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <Image 
            width={800}
            height={600}
            src={uploadedFile.url}
            alt="Uploaded resume"
            className="max-w-full max-h-full object-contain rounded-lg shadow-md"
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
      <div className="flex items-center justify-center h-full text-gray-500 bg-gray-50 rounded-lg">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p>Preview not available for this file type</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center ">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Image
                src="https://gojf7j54p4.ufs.sh/f/CcC11ljtXd0c5L0Ch2EoHV6KuzLAEMekUxlpn9y4f2c7sGdB"
                alt="SnapSum Logo"
                width={200}
                height={200}
                className=" "
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {!summary ? (
          <div className="bg-white/60 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden border border-white/50">
            {/* Upload Section */}
            <div className="p-8 sm:p-12">
              <div className="space-y-8">
                {/* User Name Input */}
                <div className="space-y-3">
                  <label htmlFor="userName" className="block text-sm font-semibold text-gray-700">
                    Your Name (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="userName"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter your name..."
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white/50 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                      disabled={processing}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    If not provided, we will use your filename
                  </p>
                </div>

                {/* Enhanced File Upload Section with Drag & Drop */}
                <div 
                  className={`relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                    isDragOver 
                      ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]' 
                      : uploadedFile 
                        ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                        : 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-6">
                    {!uploadedFile ? (
                      <>
                        {/* <div className="mx-auto h-20 w-20 text-gray-400 relative">
                          <div className={`absolute inset-0 rounded-full ${isDragOver ? 'bg-indigo-100 animate-pulse' : 'bg-gray-100'} flex items-center justify-center transition-all duration-300`}>
                            <svg className={`w-10 h-10 ${isDragOver ? 'text-indigo-500 scale-110' : 'text-gray-500'} transition-all duration-300`} stroke="currentColor" fill="none" viewBox="0 0 48 48">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div> */}
                        <div className="space-y-4">
                          {/* <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {isDragOver ? 'Drop your resume here!' : 'Upload your resume'}
                          </h3>
                          <p className="text-gray-600 mb-6 text-lg">
                            {isDragOver ? 'Release to upload' : 'Drag & drop or click to browse'}
                          </p> */}
                          <div className="flex flex-col items-center space-y-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white/70 px-4 py-2 rounded-full">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              <span>PDF, DOC, DOCX • Max 16MB</span>
                            </div>
                            
                            <UploadButton
                              endpoint="documentUploader"
                              onClientUploadComplete={(res) => {
                                handleFileSelect(res[0]);
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
                                button: `
                                  relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 
                                  hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-lg rounded-xl 
                                  transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 
                                  focus:outline-none focus:ring-4 focus:ring-indigo-500/50 border-0 cursor-pointer
                                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                `,
                                allowedContent: "text-gray-500 text-sm mt-3 opacity-75"
                              }}
                              className="upload-button-custom"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-xl shadow-md">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="text-green-700 font-semibold text-sm">{uploadedFile.name}</p>
                              <p className="text-green-600 text-xs">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                            </div>
                          </div>
                          <button
                            onClick={resetForm}
                            className="text-sm text-gray-500 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                            title="Remove file"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          </button>
                        </div>
                        
                        <button
                          onClick={() => processResumeFromUrl(uploadedFile.url, uploadedFile.name)}
                          disabled={processing}
                          className={`w-full py-4 px-8 rounded-xl font-semibold text-white text-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-[1.02] ${
                            processing
                              ? 'bg-gray-400 cursor-not-allowed scale-100'
                              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                          }`}
                        >
                          {processing ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing Resume...
                            </>
                          ) : (
                            <>
                              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                              </svg>
                              Analyze Resume with AI
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Status Messages */}
            <div className="px-8 pb-8 sm:px-12 space-y-4">
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-4 rounded-lg shadow-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {processingInfo && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-400 p-4 rounded-lg shadow-md flex items-center">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-indigo-800">{processingInfo}</p>
                </div>
              )}

              {savedRecord && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 p-4 rounded-lg shadow-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Resume saved successfully! ID: <span className="font-mono">{savedRecord.id}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden border border-white/50">
            {/* Enhanced Split View Header */}
            <div className="border-b border-gray-200 px-8 py-6 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  Resume Analysis Complete
                </h2>
                <div className="flex flex-wrap gap-3">
                                    <button 
                    onClick={downloadSummaryAsPDF}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Download PDF
                  </button>
                  <button 
                    onClick={copySummaryToClipboard}
                    className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                    Copy Text
                  </button>
                  <button 
                    onClick={resetForm}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    New Upload
                  </button>
                </div>
              </div>
            </div>

            {/* Enhanced 50/50 Split View */}
            <div className="flex flex-col xl:flex-row min-h-[600px]">
              {/* Left Side - Uploaded Resume */}
              <div className="w-full xl:w-1/2 p-8 border-b xl:border-b-0 xl:border-r border-gray-200">
                <div className="h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    Original Resume
                  </h3>
                  <div className="flex-1 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 overflow-auto relative shadow-inner border border-gray-200">
                    {previewLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                        <div className="text-center">
                          <svg className="animate-spin h-12 w-12 text-indigo-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-gray-600 font-medium">Loading preview...</p>
                        </div>
                      </div>
                    )}
                    {previewError ? (
                      <div className="flex items-center justify-center h-full text-red-500">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <p className="font-medium">{previewError}</p>
                        </div>
                      </div>
                    ) : (
                      renderFilePreview()
                    )}
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500 bg-white/70 backdrop-blur-sm px-3 py-1 rounded-full inline-block">
                      {uploadedFile?.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side - Enhanced Summary */}
              <div className="w-full xl:w-1/2 p-8">
                <div className="h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                    AI-Generated Summary
                  </h3>
                  <div className="flex-1 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 overflow-auto shadow-inner border border-green-200">
                    <div 
                      ref={summaryRef}
                      className="h-full"
                    >
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                        {summary}
                      </pre>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      <span>Generated by AI</span>
                    </div>
                    <div className="text-xs text-gray-400 bg-white/70 backdrop-blur-sm px-2 py-1 rounded">
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white/30 backdrop-blur-sm rounded-xl p-6 border border-white/50">
            <p className="text-sm text-gray-600 mb-2">
              © {new Date().getFullYear()} Resume Summary Generator. Powered by AI.
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <svg className="w-3 h-3 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                Secure & Private
              </span>
              <span className="flex items-center">
                <svg className="w-3 h-3 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                AI-Powered
              </span>
              <span className="flex items-center">
                <svg className="w-3 h-3 mr-1 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Instant Results
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for upload button styling */}
      <style jsx global>{`
        .upload-button-custom {
          position: relative;
          overflow: hidden;
          padding: 6px 16px;
          border-radius: 9999px;

        }
        
        .upload-button-custom::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }
        
        .upload-button-custom:hover::before {
          left: 100%;
        }
        
        
        .animate-drag-pulse {
          animation: dragPulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}