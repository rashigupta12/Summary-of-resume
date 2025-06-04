// app/api/process-resume/route.js
// Enhanced API route adapted for Llama models with better error handling and quota management

// import { ResumeProcessorLlama, PROVIDER_CONFIGS } from '';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { PROVIDER_CONFIGS, ResumeProcessorLlama } from '@/lib/pdf-processor';

// Rate limiting - simple in-memory store (use Redis in production)
const requestTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // Reduced for free tier APIs

// Provider-specific rate limits (requests per minute)
const PROVIDER_RATE_LIMITS = {
  openrouter: 5,   // Conservative for free tier
  groq: 10,        // Groq is generally more generous
  together: 3      // Very conservative for Together AI
};

function checkRateLimit(clientId, provider = 'openrouter') {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  const maxRequests = PROVIDER_RATE_LIMITS[provider] || MAX_REQUESTS_PER_WINDOW;
  
  if (!requestTracker.has(clientId)) {
    requestTracker.set(clientId, []);
  }
  
  const requests = requestTracker.get(clientId);
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: Math.ceil(RATE_LIMIT_WINDOW / 1000) };
  }
  
  recentRequests.push(now);
  requestTracker.set(clientId, recentRequests);
  return { 
    allowed: true, 
    remaining: maxRequests - recentRequests.length,
    resetTime: Math.ceil(RATE_LIMIT_WINDOW / 1000)
  };
}

// Initialize processor based on available API keys
function initializeProcessor() {
  // Check for available API keys in order of preference
  if (process.env.OPENROUTER_API_KEY) {
    return new ResumeProcessorLlama(PROVIDER_CONFIGS.openrouter);
  } else if (process.env.GROQ_API_KEY) {
    return new ResumeProcessorLlama(PROVIDER_CONFIGS.groq);
  } else if (process.env.TOGETHER_API_KEY) {
    return new ResumeProcessorLlama(PROVIDER_CONFIGS.together);
  } else if (process.env.LLAMA_API_KEY) {
    // Generic fallback - defaults to OpenRouter
    return new ResumeProcessorLlama({
      provider: 'openrouter',
      apiKey: process.env.LLAMA_API_KEY
    });
  }
  
  throw new Error('No Llama API key configured. Please set OPENROUTER_API_KEY, GROQ_API_KEY, or TOGETHER_API_KEY');
}

export async function POST(request) {
  const startTime = Date.now();
  let tempFilePath = null;
  let processor = null;
  
  try {
    // Initialize processor
    try {
      processor = initializeProcessor();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Llama AI service not configured. Please contact administrator.',
          configuration: {
            availableProviders: ['OpenRouter', 'Groq', 'Together AI'],
            requiredEnvVars: ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY']
          }
        },
        { status: 503 }
      );
    }

    // Get client identifier for rate limiting
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    // Check rate limit based on provider
    const rateLimitResult = checkRateLimit(clientId, processor.provider);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false,
          error: `Rate limit exceeded for ${processor.provider}. Free tier has limited requests per minute.`,
          rateLimit: {
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            provider: processor.provider,
            message: `Free tier allows limited requests. Please wait ${rateLimitResult.resetTime} seconds.`
          }
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.resetTime.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No file provided. Please select a PDF or DOCX resume file to upload.' 
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword' // Legacy .doc files
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only PDF and DOCX resume files are supported.',
          supportedTypes: ['PDF', 'DOCX'],
          receivedType: file.type
        },
        { status: 400 }
      );
    }

    // Check file size (limit to 10MB, but recommend smaller for free tier)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const recommendedSize = 5 * 1024 * 1024; // 5MB for better processing
    
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
          currentSize: `${Math.round(file.size / 1024 / 1024 * 100) / 100}MB`,
          recommendation: `For faster processing with free tier APIs, consider files under ${Math.round(recommendedSize / 1024 / 1024)}MB.`
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await mkdir(tempDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    tempFilePath = path.join(tempDir, `${timestamp}_${sanitizedFileName}`);
    
    // Save temporarily
    await writeFile(tempFilePath, buffer);

    try {
      // Process resume with Llama
      console.log(`Processing resume with ${processor.provider} (${processor.model})`);
      const result = await processor.processResume(tempFilePath);

      const processingTime = Date.now() - startTime;

      if (result.success) {
        return NextResponse.json({
          success: true,
          summary: result.summary,
          wordCount: result.wordCount,
          processedAt: result.processedAt,
          processingMode: result.processingMode,
          processingTime: `${processingTime}ms`,
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024 * 100) / 100}KB`,
          aiProvider: {
            name: processor.provider,
            model: processor.model,
            type: 'Llama'
          },
          rateLimit: {
            remaining: rateLimitResult.remaining - 1,
            resetTime: rateLimitResult.resetTime
          }
        });
      } else {
        // Return detailed error information
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            troubleshooting: result.troubleshooting,
            processingTime: `${processingTime}ms`,
            fileName: file.name,
            aiProvider: {
              name: processor.provider,
              model: processor.model,
              type: 'Llama'
            }
          },
          { status: 500 }
        );
      }
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
          console.log('Temp file cleaned up successfully');
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp file:', cleanupError);
        }
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    // Clean up temp file in case of error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file after error:', cleanupError);
      }
    }
    
    // Provide specific error responses for Llama APIs
    if (error.message?.includes('ENOENT')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resume file not found or inaccessible.',
          processingTime: `${processingTime}ms`
        },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('EMFILE') || error.message?.includes('ENFILE')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server is currently busy processing resumes. Please try again in a few moments.',
          suggestion: 'Free tier APIs have limited concurrent requests.',
          processingTime: `${processingTime}ms`
        },
        { status: 503 }
      );
    }
    
    // Llama API specific errors
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Llama API rate limit exceeded. Please wait before trying again.',
          suggestion: 'Free tier APIs have strict rate limits. Consider upgrading for higher limits.',
          processingTime: `${processingTime}ms`,
          provider: processor?.provider || 'unknown'
        },
        { status: 429 }
      );
    }
    
    if (error.message?.includes('quota') || error.message?.includes('billing')) {
      return NextResponse.json(
        {
          success: false,
          error: 'API quota exceeded or billing issue.',
          suggestion: 'Check your API provider dashboard for quota and billing status.',
          processingTime: `${processingTime}ms`,
          provider: processor?.provider || 'unknown'
        },
        { status: 402 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing your resume with Llama AI.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        processingTime: `${processingTime}ms`,
        provider: processor?.provider || 'unknown'
      },
      { status: 500 }
    );
  }
}

// Enhanced health check endpoint
export async function GET() {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      service: 'Resume Processor (Llama AI)'
    };

    // Check API key configurations
    const apiKeyStatus = {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      together: !!process.env.TOGETHER_API_KEY,
      generic: !!process.env.LLAMA_API_KEY
    };

    const configuredProviders = Object.entries(apiKeyStatus)
      .filter(([, configured]) => configured)
      .map(([provider]) => provider);

    if (configuredProviders.length === 0) {
      healthStatus.status = 'unhealthy';
      healthStatus.warnings = ['No Llama API keys configured'];
      healthStatus.configuration = {
        required: 'At least one API key needed',
        options: ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY', 'LLAMA_API_KEY']
      };
    } else {
      healthStatus.configuration = {
        configuredProviders,
        activeProvider: configuredProviders[0], // First available will be used
        totalProviders: configuredProviders.length
      };
    }

    // Test processor initialization
    try {
      const testProcessor = initializeProcessor();
      healthStatus.ai = {
        provider: testProcessor.provider,
        model: testProcessor.model,
        status: 'ready'
      };
    } catch (error) {
      healthStatus.ai = {
        status: 'error',
        error: error.message
      };
      healthStatus.status = 'degraded';
    }

    // Rate limiting status
    healthStatus.rateLimiting = {
      enabled: true,
      windowMinutes: RATE_LIMIT_WINDOW / 60000,
      limits: PROVIDER_RATE_LIMITS,
      activeConnections: requestTracker.size
    };

    return NextResponse.json(healthStatus);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        service: 'Resume Processor (Llama AI)'
      },
      { status: 500 }
    );
  }
}

// Configuration endpoint (GET /api/process-resume/config)


// Handle other HTTP methods with helpful messages
export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to upload resume files.',
      supportedMethods: ['POST', 'GET'],
      endpoints: {
        'POST /': 'Upload and process resume',
        'GET /': 'Health check',
        'GET /config': 'Get configuration'
      }
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to upload resume files.',
      supportedMethods: ['POST', 'GET']
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to upload resume files.',
      supportedMethods: ['POST', 'GET']
    },
    { status: 405 }
  );
}