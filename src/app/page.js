'use client';
import { UploadButton, uploadFiles } from '../utils/uploadthing';
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
  const uploadButtonRef = useRef(null);

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

  // Enhanced drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

const handleDrop = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    const file = files[0];
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, DOC, or DOCX file.');
      return;
    }

    // Validate file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
      setError('File size must be less than 16MB.');
      return;
    }

    setProcessingInfo('Uploading file...');
    setError(null);

    try {
      // Use UploadThing's uploadFiles function with the correct endpoint
      const uploadResult = await uploadFiles("documentUploader", {
        files: [file],
      });

      if (uploadResult && uploadResult[0]) {
        const uploadedFileData = uploadResult[0];
        handleFileSelect({
          name: file.name,
          size: file.size,
          type: file.type,
          serverData: { 
            fileUrl: uploadedFileData.url || uploadedFileData.fileUrl 
          }
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error.message}`);
    } finally {
      setProcessingInfo(null);
    }
  }
};
  const downloadSummaryAsPDF = () => {
    if (!summary) return;

    const pdf = new jsPDF();
    
    pdf.setProperties({
      title: 'Resume Summary',
      subject: 'Professional resume analysis',
      author: userName || 'Resume Summary Generator',
    });

    pdf.setFontSize(18);
    pdf.setTextColor(40);
    pdf.text('Resume Summary', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setTextColor(100);
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    pdf.setDrawColor(200);
    pdf.line(20, 32, 190, 32);
    
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    
    const splitText = pdf.splitTextToSize(summary, 170);
    
    pdf.text(splitText, 20, 40, {
      maxWidth: 170,
      lineHeightFactor: 1.5
    });
    
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
        <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-2 text-sm">Word Document</p>
            <p className="text-gray-500 text-xs mb-3">Preview not available in browser</p>
            <a 
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedFile.url)}&embedded=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex items-center justify-center h-full p-2">
          <Image 
            width={600}
            height={400}
            src={uploadedFile.url}
            alt="Uploaded resume"
            className="max-w-full max-h-full object-contain rounded-lg"
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
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p className="text-sm">Preview not available for this file type</p>
        </div>
      </div>
    );
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
    <div className="max-w-7xl mx-auto">
      {/* Header with Clear Value Proposition */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-full shadow-lg">
            <Image
              src="https://gojf7j54p4.ufs.sh/f/CcC11ljtXd0c5L0Ch2EoHV6KuzLAEMekUxlpn9y4f2c7sGdB"
              alt="SnapSum Logo"
              width={80}
              height={80}
              className="mx-auto"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Resume Summary Generator</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Get an AI-powered professional summary of your resume in seconds
        </p>
      </div>

      {/* Main Card with Clear Steps */}
      <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden border border-white/50">
        {!summary ? (
          <>
            {/* Step-by-Step Upload Process */}
            <div className="p-8">
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">1</div>
                    <div className="text-xs mt-2 text-gray-500 font-medium">Upload Resume</div>
                  </div>
                  <div className="w-16 h-1 bg-gray-200 mx-2"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">2</div>
                    <div className="text-xs mt-2 text-gray-500 font-medium">Get Summary</div>
                  </div>
                </div>
              </div>

              {/* Upload Section with Clear Instructions */}
              <div className="space-y-6">
                {/* Optional Name Field */}
                <div className="space-y-2">
                  <label htmlFor="userName" className="block text-sm font-medium text-gray-700">
                    Your Name (Optional)
                    <span className="text-xs text-gray-400 ml-1">- For personalization</span>
                  </label>
                  <input
                    type="text"
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white/80 text-gray-900 placeholder-gray-400"
                    disabled={processing}
                  />
                </div>

                {/* Enhanced Drag & Drop Area */}
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                    isDragOver 
                      ? 'border-indigo-500 bg-indigo-50/50' 
                      : uploadedFile 
                        ? 'border-green-300 bg-green-50/50' 
                        : 'border-gray-300 bg-gray-50 hover:border-indigo-400'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-5">
                    {!uploadedFile ? (
                      <>
                        <div className="flex justify-center">
                          <div className={`p-4 rounded-full ${isDragOver ? 'bg-indigo-100 animate-pulse' : 'bg-gray-100'} transition-all duration-300`}>
                            <svg className={`w-8 h-8 ${isDragOver ? 'text-indigo-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                            </svg>
                          </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800">
                          {isDragOver ? 'Drop your resume here' : 'Upload your resume'}
                        </h3>
                        <p className="text-gray-500">
                          {isDragOver ? 'Release to upload' : 'Drag & drop or click to browse files'}
                        </p>
                        <div className="pt-2">
                          <UploadButton
                            ref={uploadButtonRef}
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
                                relative inline-flex items-center px-6 py-3 bg-indigo-600 
                                hover:bg-indigo-700 text-white font-medium rounded-lg 
                                transition-all duration-200 shadow-md hover:shadow-lg
                                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                                disabled:opacity-50 disabled:cursor-not-allowed text-sm
                              `,
                              allowedContent: "hidden"
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Supported formats: PDF, DOC, DOCX (Max 16MB)
                        </p>
                      </>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">{uploadedFile.name}</p>
                            <p className="text-xs text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button
                            onClick={resetForm}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove file"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                        
                        <button
                          onClick={() => processResumeFromUrl(uploadedFile.url, uploadedFile.name)}
                          disabled={processing}
                          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg ${
                            processing
                              ? 'bg-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                          }`}
                        >
                          {processing ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                              </svg>
                              Generate AI Summary
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
            <div className="px-8 pb-8 space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {processingInfo && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">{processingInfo}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Results View */
          <div>
            {/* Results Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Your Resume Summary is Ready!
                </h2>
                <div className="mt-3 sm:mt-0 flex flex-wrap gap-2">
                  <button 
                    onClick={downloadSummaryAsPDF}
                    className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 text-sm font-medium rounded-lg transition-all duration-200 shadow hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Download PDF
                  </button>
                  <button 
                    onClick={copySummaryToClipboard}
                    className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 text-sm font-medium rounded-lg transition-all duration-200 shadow hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                    Copy Text
                  </button>
                  <button 
                    onClick={resetForm}
                    className="inline-flex items-center px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    New Resume
                  </button>
                </div>
              </div>
            </div>

            {/* Results Content */}
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Original Resume */}
                       <div >
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

                {/* AI Summary */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      AI Summary
                    </h3>
                    <span className="text-xs  bg-green-100 px-2 py-1 rounded text-green-800">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                  <div 
                    ref={summaryRef}
                    className="bg-green-50 rounded-lg p-4 h-96 overflow-auto shadow-inner border border-green-200"
                  >
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-gray-800">
                        {summary}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Resume Summary Generator. All rights reserved.
        </p>
        <div className="flex items-center justify-center mt-2 space-x-4">
          <span className="text-xs text-gray-400">Secure & Private</span>
          <span className="text-xs text-gray-400">AI-Powered Analysis</span>
          <span className="text-xs text-gray-400">No Registration Required</span>
        </div>
      </div>
    </div>
  </div>
);
}