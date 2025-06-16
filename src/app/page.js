'use client';
import { UploadButton, uploadFiles } from '../utils/uploadthing';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { jsPDF } from 'jspdf';

export default function ResumeUpload() {
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [structuredData, setStructuredData] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingInfo, setProcessingInfo] = useState(null);
  const [userName, setUserName] = useState('');
  const [savedRecord, setSavedRecord] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const summaryRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadButtonRef = useRef(null);

  const processResumeFromUrl = async (fileUrl, fileName) => {
    setProcessing(true);
    setError(null);
    setSummary(null);
    setStructuredData(null);
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
          userName: userName || fileName.replace(/\.[^/.]+$/, ""),
          extractJSON: true
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
      setStructuredData(result.structuredData);
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
    setStructuredData(null);
    setError(null);
    setProcessing(false);
    setProcessingInfo(null);
    setUserName('');
    setSavedRecord(null);
    setPreviewError(null);
    setIsDragOver(false);
    setActiveTab('summary');
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

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
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
      
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF, DOC, or DOCX file.');
        return;
      }

      if (file.size > 16 * 1024 * 1024) {
        setError('File size must be less than 16MB.');
        return;
      }

      setProcessingInfo('Uploading file...');
      setError(null);

      try {
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

  const downloadJSONData = () => {
    if (!structuredData) return;

    const dataStr = JSON.stringify(structuredData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${userName || 'resume'}-data.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const copySummaryToClipboard = () => {
    const textToCopy = activeTab === 'summary' ? summary : JSON.stringify(structuredData, null, 2);
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert(`${activeTab === 'summary' ? 'Summary' : 'JSON data'} copied to clipboard!`);
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
            Get an AI-powered professional summary and structured data of your resume in seconds
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
                      <div className="text-xs mt-2 text-gray-500 font-medium">Get Analysis</div>
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
                                Generate AI Analysis
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
                    Your Resume Analysis is Ready!
                  </h2>
                  <div className="mt-3 sm:mt-0 flex flex-wrap gap-2">
                    {activeTab === 'summary' ? (
                      <button 
                        onClick={downloadSummaryAsPDF}
                        className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-all duration-200 backdrop-blur-sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Download PDF
                      </button>
                    ) : (
                      <button 
                        onClick={downloadJSONData}
                        className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-all duration-200 backdrop-blur-sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Download JSON
                      </button>
                    )}
                    <button 
                      onClick={copySummaryToClipboard}
                      className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-all duration-200 backdrop-blur-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      Copy
                    </button>
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-all duration-200 backdrop-blur-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      Start Over
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 bg-gray-50">
                <nav className="px-8 flex space-x-8">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'summary'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    AI Summary
                  </button>
                  {structuredData && (
                    <button
                      onClick={() => setActiveTab('structured')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'structured'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Structured Data
                    </button>
                  )}
                  {uploadedFile && (
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'preview'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      File Preview
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-8">
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Professional Summary
                      </h3>
                      <div 
                        ref={summaryRef}
                        className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap"
                      >
                        {summary}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'structured' && structuredData && (
                  <div className="space-y-6">
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                        Structured Data (JSON)
                      </h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 border">
                        {JSON.stringify(structuredData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && uploadedFile && (
                  <div className="space-y-6">
                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          File Preview
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{uploadedFile.name}</p>
                      </div>
                      <div className="relative" style={{ height: '600px' }}>
                        {previewLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                            <div className="flex items-center space-x-2">
                              <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-sm text-gray-600">Loading preview...</span>
                            </div>
                          </div>
                        )}
                        {previewError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                            <div className="text-center">
                              <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              <p className="text-sm text-red-600">{previewError}</p>
                            </div>
                          </div>
                        )}
                        {renderFilePreview()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Success Message for Saved Record */}
        {savedRecord && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Resume processed successfully!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Your resume analysis has been saved and is ready for download.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Powered by AI • Secure & Private • No data stored permanently
          </p>
        </div>
      </div>
    </div>
  );
}