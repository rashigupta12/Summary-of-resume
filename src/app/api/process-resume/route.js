// app/api/process-resume/route.js (Updated with recruiter-focused summary)
import { usersTable } from '../../../db/schema';
import { db } from '../../../db/index';
import { NextRequest, NextResponse } from 'next/server';

// Configuration
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB (matching UploadThing limit)
const MAX_TEXT_LENGTH = 15000;
const MIN_TEXT_LENGTH = 100;

// Supported file types
const SUPPORTED_MIME_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'text/plain': 'txt'
};

// Updated prompt for recruiter-focused analysis
const createAnalysisPrompt = (resumeText) => `
You are an expert recruiter and hiring manager. Analyze the following resume and provide a concise, recruiter-focused summary for quick hiring decisions.

Format your response as:

**CANDIDATE SUMMARY (For Recruiter Use)**

* **Profile:** [Education/degree, CGPA/grades if mentioned, key academic highlights - max 1 line]
* **Experience:** [Total experience, number of internships/jobs, key companies/roles - max 1 line]  
* **Tech Skills:** [List 5-7 most relevant technical skills, highlight the strongest ones in bold]
* **Key Projects:** [2-3 most impressive projects with brief impact/results - max 1 line]
* **Highlights:**
   * [3-4 bullet points of most impressive achievements, awards, or unique qualities]
   * [Include specific metrics, competition wins, leadership roles if available]
   * [Focus on what makes this candidate stand out for hiring]
* **Soft Skills:** [Communication, teamwork, leadership experience - max 1 line]

**QUICK HIRE ASSESSMENT:**
* **Strengths:** [Top 2-3 reasons to hire this candidate]
* **Experience Level:** [Entry/Junior/Mid/Senior level with years]
* **Best Fit For:** [Types of roles/teams this candidate would excel in]

Keep the entire summary under 150 words. Focus on what a recruiter needs to know for quick screening and hiring decisions. Be specific and highlight measurable achievements.

Resume Content:
${resumeText}

Provide a concise, action-oriented summary that helps recruiters make fast hiring decisions.`;

// Enhanced API call with retry logic
async function callMistralAPI(resumeText, retries = 2) {
  const prompt = createAnalysisPrompt(resumeText);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000, // Reduced for shorter summaries
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Mistral API');
      }

      return {
        analysis: data.choices[0].message.content,
        tokensUsed: data.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error(`API attempt ${attempt + 1} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Save resume analysis to database
async function saveResumeToDatabase(name, resumeUrl, summaryOfResume) {
  try {
    console.log('Saving resume to database:', { name, resumeUrl });
    
    const result = await db.insert(usersTable).values({
      name: name,
      resumeUrl: resumeUrl,
      summaryOfResume: summaryOfResume,
    }).returning({
      id: usersTable.id,
      name: usersTable.name,
      resumeUrl: usersTable.resumeUrl,
      createdAt: usersTable.createdAt,
    });

    console.log('Resume saved successfully:', result[0]);
    return result[0];

  } catch (error) {
    console.error('Database save error:', error);
    throw new Error(`Failed to save resume to database: ${error.message}`);
  }
}

// Fetch file from URL
async function fetchFileFromUrl(fileUrl) {
  try {
    console.log('Fetching file from URL:', fileUrl);
    
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const buffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);
    
    // Get content type from response headers
    const contentType = response.headers.get('content-type') || '';
    
    console.log('File fetched successfully:', {
      size: fileBuffer.length,
      contentType: contentType
    });

    return {
      buffer: fileBuffer,
      contentType: contentType,
      size: fileBuffer.length
    };

  } catch (error) {
    console.error('Error fetching file from URL:', error);
    throw new Error(`Failed to fetch file from URL: ${error.message}`);
  }
}

// Determine file type from URL and content type
function determineFileType(fileUrl, contentType, fileName) {
  // First try to determine from content type
  if (contentType && SUPPORTED_MIME_TYPES[contentType]) {
    return SUPPORTED_MIME_TYPES[contentType];
  }

  // Fallback to file extension from URL or filename
  const url = fileName || fileUrl;
  const extension = url.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'doc':
      return 'doc';
    case 'txt':
      return 'txt';
    default:
      throw new Error(`Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.`);
  }
}

// Fixed PDF text extraction using pdf-parse
async function extractTextFromPDF(buffer) {
  try {
    // Import pdf-parse directly from its implementation file
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    
    console.log('Extracting text from PDF buffer, size:', buffer.length);
    
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No readable text found in PDF. The file might be image-based or corrupted.');
    }

    let cleanText = data.text
      .replace(/\f/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log('PDF text extracted successfully, length:', cleanText.length);

    return {
      text: cleanText,
      pages: data.numpages,
      metadata: data.info
    };

  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// Enhanced Word document extraction
async function extractTextFromWord(buffer) {
  try {
    const mammoth = (await import('mammoth')).default;
    
    console.log('Extracting text from Word buffer, size:', buffer.length);
    
    const result = await mammoth.extractRawText({ 
      buffer,
      options: {
        includeDefaultStyleMap: true
      }
    });

    if (!result.value || result.value.trim().length === 0) {
      throw new Error('No text found in the Word document. The file might be empty or corrupted.');
    }

    const cleanText = result.value
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log('Word text extracted successfully, length:', cleanText.length);

    return {
      text: cleanText,
      warnings: result.messages || []
    };

  } catch (error) {
    console.error('Word extraction error:', error);
    throw new Error(`Failed to extract text from Word document: ${error.message}`);
  }
}

// Validate and clean extracted text
function validateAndCleanText(text, filename) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text extracted from document');
  }

  const trimmedText = text.trim();
  
  if (trimmedText.length < MIN_TEXT_LENGTH) {
    throw new Error(`Document appears to be too short (${trimmedText.length} characters). Please ensure your resume has substantial content.`);
  }

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    console.log(`Truncating text from ${trimmedText.length} to ${MAX_TEXT_LENGTH} characters for ${filename}`);
    return trimmedText.substring(0, MAX_TEXT_LENGTH) + '\n\n[Document truncated for processing...]';
  }

  return trimmedText;
}

// Main POST handler for App Router
export async function POST(request) {
  const startTime = Date.now();

  try {
    console.log('=== RESUME PROCESSING START ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    
    // Validate API key
    if (!MISTRAL_API_KEY) {
      console.error('Mistral API key not found in environment variables');
      return NextResponse.json({ 
        error: 'Resume analysis service is not properly configured. Please contact support.' 
      }, { status: 500 });
    }

    // Get JSON data from request body
    console.log('Parsing JSON data...');
    const body = await request.json();
    const { fileUrl, fileName, userName } = body;

    console.log('Request body:', { fileUrl, fileName, userName });

    if (!fileUrl) {
      return NextResponse.json({ 
        error: 'No file URL provided. Please upload a file first.' 
      }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ 
        error: 'No file name provided.' 
      }, { status: 400 });
    }

    // Default userName if not provided
    const nameToSave = userName || fileName.replace(/\.[^/.]+$/, ""); // Remove file extension as fallback

    // Fetch file from URL
    const { buffer: fileBuffer, contentType, size } = await fetchFileFromUrl(fileUrl);

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Determine file type
    const fileType = determineFileType(fileUrl, contentType, fileName);
    
    console.log(`Processing: ${fileName} (${fileType}, ${size} bytes)`);

    let extractionResult;

    // Extract text based on file type
    console.log(`Extracting text using ${fileType} processor...`);
    switch (fileType) {
      case 'docx':
        extractionResult = await extractTextFromWord(fileBuffer);
        break;
      case 'doc':
        return NextResponse.json({ 
          error: 'Legacy .doc format requires conversion. Please save as .docx format for better compatibility.' 
        }, { status: 400 });
      case 'pdf':
        extractionResult = await extractTextFromPDF(fileBuffer);
        break;
      case 'txt':
        extractionResult = { text: fileBuffer.toString('utf-8') };
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Validate and clean the extracted text
    const resumeText = validateAndCleanText(extractionResult.text, fileName);
    
    console.log(`Text extracted successfully: ${resumeText.length} characters`);
    console.log('First 200 characters:', resumeText.substring(0, 200) + '...');

    // Analyze with Mistral AI
    console.log('Calling Mistral API...');
    const { analysis, tokensUsed } = await callMistralAPI(resumeText);

    // Save to database
    console.log('Saving to database...');
    const savedRecord = await saveResumeToDatabase(nameToSave, fileUrl, analysis);

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`Processing completed in ${processingTime}ms`);

    // Return successful response with database record info
    return NextResponse.json({
      success: true,
      summary: analysis, // Frontend expects 'summary' property
      data: {
        analysis,
        savedRecord: savedRecord, // Include database record info
        metadata: {
          fileName: fileName,
          fileType,
          fileSize: size,
          fileUrl: fileUrl,
          textLength: resumeText.length,
          originalTextLength: extractionResult.text.length,
          truncated: extractionResult.text.length > MAX_TEXT_LENGTH,
          processingTimeMs: processingTime,
          tokensUsed,
          extractionWarnings: extractionResult.warnings || []
        }
      }
    });

  } catch (error) {
    console.error('=== RESUME PROCESSING ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    
    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred while processing your resume.';

    if (error.message.includes('Mistral API error')) {
      statusCode = 502;
      errorMessage = 'AI analysis service is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('File too large')) {
      statusCode = 413;
      errorMessage = error.message;
    } else if (error.message.includes('No text found') || 
               error.message.includes('too short') ||
               error.message.includes('Failed to extract')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Unsupported file type')) {
      statusCode = 415;
      errorMessage = error.message;
    } else if (error.message.includes('Failed to fetch file')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Failed to save resume to database')) {
      statusCode = 500;
      errorMessage = 'Resume was analyzed successfully but could not be saved. Please try again.';
    }

    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: statusCode });
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST to process resume.' 
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST to process resume.' 
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST to process resume.' 
  }, { status: 405 });
}