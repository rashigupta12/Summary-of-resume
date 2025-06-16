// app/api/process-resume/route.js (Fixed JSON extraction and summary)
import { usersTable } from "../../../db/schema";
import { db } from "../../../db/index";
import { NextRequest, NextResponse } from "next/server";

// Configuration
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB (matching UploadThing limit)
const MAX_TEXT_LENGTH = 15000;
const MIN_TEXT_LENGTH = 100;

// Supported file types
const SUPPORTED_MIME_TYPES = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "doc",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

function extractUrlsFromText(text) {
  const urlPatterns = [
    // Full HTTP/HTTPS URLs
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    // Domain names (with common TLDs)
    /(?:^|\s)((?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|ai|dev|app|tech|me|info|biz|us|uk|de|fr|jp|cn|in|br|ru|au|ca|it|es|nl|se|no|dk|fi|pl|cz|hu|ro|bg|hr|si|sk|lt|lv|ee|gr|pt|ie|at|ch|be|lu|mc|li|is|mt|cy|tr|kz|uz|kg|tj|tm|az|ge|am|by|ua|md|rs|me|mk|al|ba|xk|ly|dz|ma|tn|eg|sd|et|ke|tz|ug|rw|mw|zm|zw|za|bw|na|sz|ls|mg|mu|sc|km|dj|so|er))\b/gi,
    // Email addresses
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    // GitHub patterns
    /github\.com\/[a-zA-Z0-9_-]+/gi,
    // Social media handles
    /@[a-zA-Z0-9_]+/g,
    // Common short URLs
    /(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|short\.link)\/[a-zA-Z0-9_-]+/gi
  ];

  const extractedUrls = [];
  
  urlPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      extractedUrls.push(...matches);
    }
  });

  return [...new Set(extractedUrls)]; // Remove duplicates
}

function categorizeUrls(urls) {
  const categorized = {
    github: [],
    linkedin: [],
    portfolio: [],
    social: [],
    professional: [],
    other: []
  };

  urls.forEach(url => {
    const cleanUrl = url.trim().toLowerCase();
    
    if (cleanUrl.includes('github.com')) {
      categorized.github.push(url);
    } else if (cleanUrl.includes('linkedin.com')) {
      categorized.linkedin.push(url);
    } else if (cleanUrl.includes('portfolio') || cleanUrl.endsWith('.dev') || cleanUrl.endsWith('.me')) {
      categorized.portfolio.push(url);
    } else if (cleanUrl.includes('twitter.com') || cleanUrl.includes('instagram.com') || cleanUrl.includes('facebook.com')) {
      categorized.social.push(url);
    } else if (cleanUrl.includes('stackoverflow.com') || cleanUrl.includes('medium.com') || cleanUrl.includes('dev.to')) {
      categorized.professional.push(url);
    } else {
      categorized.other.push(url);
    }
  });

  return categorized;
}

// JSON extraction prompt
const createJSONExtractionPrompt = (resumeText) => `
You are an expert resume parser with special focus on extracting ALL URLs, links, and online profiles. Extract all information from the following resume and convert it into a structured JSON format. Pay special attention to finding URLs, GitHub links, portfolio links, social media profiles, and any clickable content.

IMPORTANT: Look for URLs in these formats:
- Full URLs: https://github.com/username, http://example.com
- Shortened URLs: bit.ly/xyz, tinyurl.com/xyz
- Social handles: @username, username (when in context of social media)
- Domain names: example.com, github.com/username
- Email addresses that might contain profile info
- Any text that appears to be a clickable link or profile reference

Return ONLY valid JSON in this exact structure (fill with actual data from resume):

{
  "personalInfo": {
    "name": "",
    "title": "",
    "summary": "",
    "contact": {
      "email": "",
      "phone": "",
      "address": "",
      "city": "",
      "state": "",
      "country": "",
      "postalCode": "",
      "linkedin": "",
      "github": "",
      "portfolio": "",
      "website": "",
      "socialProfiles": {
        "twitter": "",
        "instagram": "",
        "facebook": "",
        "youtube": "",
        "medium": "",
        "dev": "",
        "stackoverflow": "",
        "behance": "",
        "dribbble": "",
        "other": []
      }
    }
  },
  "education": [
    {
      "degree": "",
      "field": "",
      "institution": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "gpa": "",
      "cgpa": "",
      "percentage": "",
      "honors": [],
      "relevantCoursework": [],
      "activities": [],
      "institutionWebsite": "",
      "verificationUrl": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "position": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "type": "",
      "description": "",
      "responsibilities": [],
      "achievements": [],
      "technologies": [],
      "companyWebsite": "",
      "linkedinCompany": "",
      "projectUrls": []
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "startDate": "",
      "endDate": "",
      "status": "",
      "role": "",
      "technologies": [],
      "features": [],
      "links": {
        "demo": "",
        "live": "",
        "github": "",
        "gitlab": "",
        "bitbucket": "",
        "documentation": "",
        "figma": "",
        "prototype": "",
        "video": "",
        "presentation": "",
        "other": []
      },
      "achievements": [],
      "media": {
        "screenshots": [],
        "videos": [],
        "presentations": []
      }
    }
  ],
  "skills": {
    "technical": {
      "programmingLanguages": [],
      "frameworks": [],
      "libraries": [],
      "databases": [],
      "tools": [],
      "platforms": [],
      "operatingSystems": [],
      "cloudServices": [],
      "versionControl": [],
      "other": []
    },
    "soft": [],
    "languages": [
      {
        "language": "",
        "proficiency": ""
      }
    ]
  },
  "certifications": [
    {
      "name": "",
      "issuer": "",
      "date": "",
      "expiryDate": "",
      "credentialId": "",
      "url": "",
      "verificationUrl": "",
      "badgeUrl": ""
    }
  ],
  "awards": [
    {
      "title": "",
      "issuer": "",
      "date": "",
      "description": "",
      "url": "",
      "certificateUrl": ""
    }
  ],
  "publications": [
    {
      "title": "",
      "authors": [],
      "venue": "",
      "date": "",
      "url": "",
      "doi": "",
      "type": "",
      "pdfUrl": ""
    }
  ],
  "volunteering": [
    {
      "organization": "",
      "role": "",
      "startDate": "",
      "endDate": "",
      "description": "",
      "activities": [],
      "website": "",
      "linkedinOrg": ""
    }
  ],
  "onlinePresence": {
    "personalWebsite": "",
    "blog": "",
    "portfolio": "",
    "github": "",
    "gitlab": "",
    "linkedin": "",
    "twitter": "",
    "medium": "",
    "devTo": "",
    "stackoverflow": "",
    "codepen": "",
    "behance": "",
    "dribbble": "",
    "youtube": "",
    "twitch": "",
    "discord": "",
    "telegram": "",
    "other": []
  },
  "interests": [],
  "references": [
    {
      "name": "",
      "title": "",
      "company": "",
      "email": "",
      "phone": "",
      "relationship": "",
      "linkedin": ""
    }
  ],
  "additionalSections": {
    "hobbies": [],
    "personalProjects": [],
    "communityInvolvement": [],
    "speaking": [],
    "mentoring": [],
    "openSource": [],
    "patents": [],
    "competitions": []
  }
}

EXTRACTION INSTRUCTIONS:
1. **URL Detection Priority**: Scan the entire resume text for ANY text that could be a URL or web reference
2. **Profile Extraction**: Look for social media handles, usernames, and profile references
3. **Context Clues**: If you see words like "GitHub:", "Portfolio:", "Website:", "LinkedIn:" followed by text, treat that text as a URL
4. **Handle Variations**: Extract usernames/handles even if not in full URL format (e.g., "github: username" should become "https://github.com/username")
5. **Multiple Formats**: Look for URLs in different formats:
   - https://example.com
   - http://example.com
   - www.example.com
   - example.com
   - @username (social media)
   - username (when in social context)
6. **Project Links**: Pay special attention to project descriptions for demo links, GitHub repos, live sites
7. **Company/Institution URLs**: Extract organization websites from experience and education sections
8. **Email Domains**: Sometimes profile info is embedded in email addresses or mentioned near them
9. **Text Processing**: Clean and standardize URLs (add https:// if missing, expand short URLs when obvious)
10. **Comprehensive Search**: Don't miss any links - scan headers, footers, contact sections, project descriptions, and any other text

SPECIFIC PATTERNS TO LOOK FOR:
- "Profiles" sections with lists of social media
- Project descriptions mentioning "live at", "demo:", "github:", "repo:"
- Contact information with multiple platforms
- Portfolio or personal website mentions
- Company websites in experience sections
- Institution websites in education sections
- Certification or badge URLs
- Any clickable or underlined text that might be a link

If a field is not present, use null or empty array/object as appropriate.
For dates, use format "YYYY-MM" or "YYYY" if month not specified.
For current positions, set "current": true and "endDate": null.
Be precise with technical skills categorization.
Include all achievements, metrics, and quantifiable results.
Maintain original wording for descriptions and achievements.
Return ONLY the JSON object, no additional text.

Resume Content:
${resumeText}`;

// Updated prompt for recruiter-focused summary
const createAnalysisPrompt = (resumeText) => `
You are an expert recruiter and hiring manager. Analyze the following resume and provide a concise, recruiter-focused summary for quick hiring decisions.

Format your response as:

* Profile: [Education/degree, CGPA/grades if mentioned, key academic highlights - max 1 line]
* Experience: [Total experience, number of internships/jobs, key companies/roles - max 1 line]  
* Tech Skills: [List 5-7 most relevant technical skills, highlight the strongest ones in bold]
* Key Projects: [2-3 most impressive projects with brief impact/results - max 1 line]
* Highlights:
   * [3-4 bullet points of most impressive achievements, awards, or unique qualities]
   * [Include specific metrics, competition wins, leadership roles if available]
   * [Focus on what makes this candidate stand out for hiring]
* Soft Skills: [Communication, teamwork, leadership experience - max 1 line]

**QUICK HIRE ASSESSMENT:**
* Strengths: [Top 2-3 reasons to hire this candidate]
* Experience Level: [Entry/Junior/Mid/Senior level with years]
* Best Fit For: [Types of roles/teams this candidate would excel in]

Keep the entire summary under 150 words. Focus on what a recruiter needs to know for quick screening and hiring decisions. Be specific and highlight measurable achievements.

Resume Content:
${resumeText}

Provide a concise, action-oriented summary that helps recruiters make fast hiring decisions.`;

// FIXED: Correct function name for JSON extraction
async function callMistralAPIForJSON(resumeText, retries = 2) {
  // First, extract URLs using regex
  const extractedUrls = extractUrlsFromText(resumeText);
  const categorizedUrls = categorizeUrls(extractedUrls);
  
  console.log('Extracted URLs:', extractedUrls);
  console.log('Categorized URLs:', categorizedUrls);

  const prompt = createJSONExtractionPrompt(resumeText);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 6000, // Increased for more comprehensive JSON
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Mistral API error: ${response.status} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from Mistral API");
      }

      const jsonString = data.choices[0].message.content.trim();

      let parsedJSON;
      try {
        const cleanJsonString = jsonString
          .replace(/^```json\n?/, "")
          .replace(/\n?```$/, "");
        parsedJSON = JSON.parse(cleanJsonString);
        
        // Enhance parsed JSON with extracted URLs
        if (extractedUrls.length > 0) {
          // Add extracted URLs to appropriate sections
          parsedJSON.extractedUrls = categorizedUrls;
          
          // Enhance existing fields with found URLs
          if (categorizedUrls.github.length > 0 && !parsedJSON.personalInfo.contact.github) {
            parsedJSON.personalInfo.contact.github = categorizedUrls.github[0];
          }
          
          if (categorizedUrls.linkedin.length > 0 && !parsedJSON.personalInfo.contact.linkedin) {
            parsedJSON.personalInfo.contact.linkedin = categorizedUrls.linkedin[0];
          }
          
          if (categorizedUrls.portfolio.length > 0 && !parsedJSON.personalInfo.contact.portfolio) {
            parsedJSON.personalInfo.contact.portfolio = categorizedUrls.portfolio[0];
          }
        }
        
      } catch (parseError) {
        throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
      }

      return {
        structuredData: parsedJSON,
        rawJSON: jsonString,
        extractedUrls: extractedUrls,
        categorizedUrls: categorizedUrls,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error(`JSON extraction API attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}

// Enhanced API call with retry logic for summary
async function callMistralAPI(resumeText, retries = 2) {
  const prompt = createAnalysisPrompt(resumeText);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1000,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Mistral API error: ${response.status} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from Mistral API");
      }

      return {
        analysis: data.choices[0].message.content,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error(`Summary API attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}

// Enhanced save function to include structured data
async function saveResumeToDatabase(
  name,
  resumeUrl,
  summaryOfResume,
  structuredData = null
) {
  try {
    console.log("Saving resume to database:", { name, resumeUrl });

    const result = await db
      .insert(usersTable)
      .values({
        name: name,
        resumeUrl: resumeUrl,
        summaryOfResume: summaryOfResume,
        structuredData: structuredData, // Save as JSON object directly (not stringified)
      })
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        resumeUrl: usersTable.resumeUrl,
        structuredData: usersTable.structuredData,
        createdAt: usersTable.createdAt,
      });

    console.log("Resume saved successfully:", result[0]);
    return result[0];
  } catch (error) {
    console.error("Database save error:", error);
    throw new Error(`Failed to save resume to database: ${error.message}`);
  }
}

// Fetch file from URL
async function fetchFileFromUrl(fileUrl) {
  try {
    console.log("Fetching file from URL:", fileUrl);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      throw new Error(
        `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    const buffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Get content type from response headers
    const contentType = response.headers.get("content-type") || "";

    console.log("File fetched successfully:", {
      size: fileBuffer.length,
      contentType: contentType,
    });

    return {
      buffer: fileBuffer,
      contentType: contentType,
      size: fileBuffer.length,
    };
  } catch (error) {
    console.error("Error fetching file from URL:", error);
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
  const extension = url.toLowerCase().split(".").pop();

  switch (extension) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "doc":
      return "doc";
    case "txt":
      return "txt";
    default:
      throw new Error(
        `Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.`
      );
  }
}

// Fixed PDF text extraction using pdf-parse
async function extractTextFromPDF(buffer) {
  try {
    // Import pdf-parse directly from its implementation file
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");

    console.log("Extracting text from PDF buffer, size:", buffer.length);

    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        "No readable text found in PDF. The file might be image-based or corrupted."
      );
    }

    let cleanText = data.text
      .replace(/\f/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    console.log("PDF text extracted successfully, length:", cleanText.length);

    return {
      text: cleanText,
      pages: data.numpages,
      metadata: data.info,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// Enhanced Word document extraction
async function extractTextFromWord(buffer) {
  try {
    const mammoth = (await import("mammoth")).default;

    console.log("Extracting text from Word buffer, size:", buffer.length);

    const result = await mammoth.extractRawText({
      buffer,
      options: {
        includeDefaultStyleMap: true,
      },
    });

    if (!result.value || result.value.trim().length === 0) {
      throw new Error(
        "No text found in the Word document. The file might be empty or corrupted."
      );
    }

    const cleanText = result.value
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    console.log("Word text extracted successfully, length:", cleanText.length);

    return {
      text: cleanText,
      warnings: result.messages || [],
    };
  } catch (error) {
    console.error("Word extraction error:", error);
    throw new Error(
      `Failed to extract text from Word document: ${error.message}`
    );
  }
}

// Validate and clean extracted text
function validateAndCleanText(text, filename) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text extracted from document");
  }

  const trimmedText = text.trim();

  if (trimmedText.length < MIN_TEXT_LENGTH) {
    throw new Error(
      `Document appears to be too short (${trimmedText.length} characters). Please ensure your resume has substantial content.`
    );
  }

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    console.log(
      `Truncating text from ${trimmedText.length} to ${MAX_TEXT_LENGTH} characters for ${filename}`
    );
    return (
      trimmedText.substring(0, MAX_TEXT_LENGTH) +
      "\n\n[Document truncated for processing...]"
    );
  }

  return trimmedText;
}

// Main POST handler for App Router
export async function POST(request) {
  const startTime = Date.now();

  try {
    console.log("=== ENHANCED RESUME PROCESSING START ===");
    console.log("Request URL:", request.url);
    console.log("Request method:", request.method);

    // Validate API key
    if (!MISTRAL_API_KEY) {
      console.error("Mistral API key not found in environment variables");
      return NextResponse.json(
        {
          error:
            "Resume analysis service is not properly configured. Please contact support.",
        },
        { status: 500 }
      );
    }

    // Get JSON data from request body
    console.log("Parsing JSON data...");
    const body = await request.json();
    const { fileUrl, fileName, userName, extractJSON = true } = body;

    console.log("Request body:", { fileUrl, fileName, userName, extractJSON });

    if (!fileUrl) {
      return NextResponse.json(
        {
          error: "No file URL provided. Please upload a file first.",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          error: "No file name provided.",
        },
        { status: 400 }
      );
    }

    // Default userName if not provided
    const nameToSave = userName || fileName.replace(/\.[^/.]+$/, ""); // Remove file extension as fallback

    // Fetch file from URL
    const {
      buffer: fileBuffer,
      contentType,
      size,
    } = await fetchFileFromUrl(fileUrl);

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Determine file type
    const fileType = determineFileType(fileUrl, contentType, fileName);

    console.log(`Processing: ${fileName} (${fileType}, ${size} bytes)`);

    let extractionResult;

    // Extract text based on file type
    console.log(`Extracting text using ${fileType} processor...`);
    switch (fileType) {
      case "docx":
        extractionResult = await extractTextFromWord(fileBuffer);
        break;
      case "doc":
        return NextResponse.json(
          {
            error:
              "Legacy .doc format requires conversion. Please save as .docx format for better compatibility.",
          },
          { status: 400 }
        );
      case "pdf":
        extractionResult = await extractTextFromPDF(fileBuffer);
        break;
      case "txt":
        extractionResult = { text: fileBuffer.toString("utf-8") };
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Validate and clean the extracted text
    const resumeText = validateAndCleanText(extractionResult.text, fileName);

    console.log(`Text extracted successfully: ${resumeText.length} characters`);
    console.log("First 200 characters:", resumeText.substring(0, 200) + "...");

    // Parallel processing for better performance
    const promises = [
      callMistralAPI(resumeText), // Summary analysis
    ];

    // Add JSON extraction if requested
    if (extractJSON) {
      promises.push(callMistralAPIForJSON(resumeText)); // FIXED: Correct function name
    }

    console.log("Calling Mistral API for analysis and JSON extraction...");
    const results = await Promise.all(promises);

    const { analysis, tokensUsed: summaryTokens } = results[0];
    let structuredData = null;
    let jsonTokens = 0;
    let extractedUrls = [];
    let categorizedUrls = {};

    if (extractJSON && results[1]) {
      const jsonResult = results[1];
      structuredData = jsonResult.structuredData;
      jsonTokens = jsonResult.tokensUsed;
      extractedUrls = jsonResult.extractedUrls || [];
      categorizedUrls = jsonResult.categorizedUrls || {};
    }

    // Save to database
    console.log("Saving to database...");
    const savedRecord = await saveResumeToDatabase(
      nameToSave,
      fileUrl,
      analysis,
      structuredData
    );

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`Processing completed in ${processingTime}ms`);

    // Return successful response with enhanced data
    return NextResponse.json({
      success: true,
      summary: analysis, // Frontend expects 'summary' property
      structuredData: structuredData, // New: structured JSON data
      data: {
        id: savedRecord.id,
        name: savedRecord.name,
        analysis,
        structuredData,
        savedRecord: savedRecord,
        extractedUrls: extractedUrls,
        categorizedUrls: categorizedUrls,
        metadata: {
          fileName: fileName,
          fileType: fileType,
          fileSize: size,
          processingTime: processingTime,
          tokensUsed: {
            summary: summaryTokens,
            json: jsonTokens,
            total: summaryTokens + jsonTokens,
          },
          extractionDetails: {
            textLength: resumeText.length,
            urlsFound: extractedUrls.length,
            ...extractionResult,
          },
        },
      },
    });
  } catch (error) {
    console.error("=== ENHANCED RESUME PROCESSING ERROR ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage =
      "An unexpected error occurred while processing your resume.";

    if (error.message.includes("Mistral API error")) {
      statusCode = 502;
      errorMessage =
        "AI analysis service is temporarily unavailable. Please try again later.";
    } else if (error.message.includes("Invalid JSON response")) {
      statusCode = 502;
      errorMessage =
        "AI service returned invalid data format. Please try again.";
    } else if (error.message.includes("File too large")) {
      statusCode = 413;
      errorMessage = error.message;
    } else if (
      error.message.includes("No text found") ||
      error.message.includes("too short") ||
      error.message.includes("Failed to extract")
    ) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes("Unsupported file type")) {
      statusCode = 415;
      errorMessage = error.message;
    } else if (error.message.includes("Failed to fetch file")) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes("Failed to save resume to database")) {
      statusCode = 500;
      errorMessage =
        "Resume was analyzed successfully but could not be saved. Please try again.";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: statusCode }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST to process resume.",
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST to process resume.",
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST to process resume.",
    },
    { status: 405 }
  );
}
