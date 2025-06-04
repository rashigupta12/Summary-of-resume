// Enhanced resume processor adapted for Llama models via OpenRouter
// lib/pdf-processor-llama.js

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatOpenAI } from "@langchain/openai"; // Using ChatOpenAI for better compatibility
import { loadSummarizationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import fs from 'fs';
import path from 'path';

export class ResumeProcessorLlama {
  constructor(options = {}) {
    const {
      provider = 'openrouter', // 'openrouter', 'groq', 'together'
      model = 'meta-llama/llama-3.3-8b-instruct:free',
      apiKey = process.env.OPENROUTER_API_KEY || process.env.LLAMA_API_KEY
    } = options;

    // Configure based on provider
    this.provider = provider;
    this.model = model;
    
    if (provider === 'openrouter') {
      this.llm = new ChatOpenAI({
        modelName: model,
        temperature: 0.3,
        openAIApiKey: apiKey,
        basePath: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000", // Replace with your domain
          "X-Title": "Resume Processor",
        },
        maxRetries: 3,
        requestTimeout: 60000,
        maxConcurrency: 1,
      });
    } else if (provider === 'groq') {
      this.llm = new ChatOpenAI({
        modelName: "llama3-8b-8192", // Groq's Llama model name
        temperature: 0.3,
        openAIApiKey: apiKey,
        basePath: "https://api.groq.com/openai/v1",
        maxRetries: 3,
        requestTimeout: 60000,
        maxConcurrency: 1,
      });
    } else if (provider === 'together') {
      this.llm = new ChatOpenAI({
        modelName: "meta-llama/Llama-2-7b-chat-hf",
        temperature: 0.3,
        openAIApiKey: apiKey,
        basePath: "https://api.together.xyz/v1",
        maxRetries: 3,
        requestTimeout: 60000,
        maxConcurrency: 1,
      });
    }
    
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000, // Llama models can handle larger chunks efficiently
      chunkOverlap: 200,
    });
  }

  // Retry mechanism with exponential backoff (same as original)
  async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Check if it's a rate limit error
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate')) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  // Load and process PDF/DOCX files (same as original)
  async loadDocument(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    let loader;

    try {
      if (fileExtension === '.pdf') {
        loader = new PDFLoader(filePath);
      } else if (fileExtension === '.docx') {
        loader = new DocxLoader(filePath);
      } else {
        throw new Error('Unsupported file format. Only PDF and DOCX are supported.');
      }

      const docs = await loader.load();
      return docs;
    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }

  // Extract and clean text from documents (same as original)
  async extractText(docs) {
    const fullText = docs.map(doc => doc.pageContent).join('\n');
    
    const cleanedText = fullText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .replace(/[^\w\s@.-]/g, '')
      .trim();
    
    return cleanedText;
  }

  // Enhanced fallback summary for Llama (same logic, better formatting)
  generateBasicSummary(text) {
    const words = text.toLowerCase().split(/\s+/);
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
    const phoneMatch = text.match(/[\d\s\-\(\)]{10,}/g);
    
    const experienceKeywords = ['experience', 'work', 'employment', 'position', 'role'];
    const educationKeywords = ['education', 'degree', 'university', 'college', 'school'];
    const skillsKeywords = ['skills', 'technologies', 'expertise', 'proficient'];
    
    const summary = {
      wordCount: words.length,
      estimatedSections: {
        hasContact: !!(emailMatch || phoneMatch),
        hasExperience: experienceKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        ),
        hasEducation: educationKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        ),
        hasSkills: skillsKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        )
      },
      contact: {
        emails: emailMatch || [],
        phones: phoneMatch || []
      },
      keyTerms: this.extractKeyTerms(text)
    };

    return `
**Basic Resume Analysis** (Llama AI unavailable - using fallback)

**Document Statistics:**
- Word Count: ${summary.wordCount}
- Estimated Sections: ${Object.values(summary.estimatedSections).filter(Boolean).length}/4 standard sections detected

**Contact Information:**
- Email(s) found: ${summary.contact.emails.length > 0 ? 'Yes' : 'No'}
- Phone(s) found: ${summary.contact.phones.length > 0 ? 'Yes' : 'No'}

**Content Analysis:**
- Contains Experience Section: ${summary.estimatedSections.hasExperience ? 'Yes' : 'No'}
- Contains Education Section: ${summary.estimatedSections.hasEducation ? 'Yes' : 'No'}
- Contains Skills Section: ${summary.estimatedSections.hasSkills ? 'Yes' : 'No'}

**Key Terms Detected:**
${summary.keyTerms.slice(0, 10).join(', ')}

**Note:** This is a basic text analysis. For AI-powered summaries, check your ${this.provider} API key and quota.
    `;
  }

  // Extract key terms (same as original)
  extractKeyTerms(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  // Optimized prompt for Llama models
  async summarizeResume(text) {
    // Llama-optimized prompt with clear instructions
    const summaryPrompt = PromptTemplate.fromTemplate(`
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert HR professional analyzing resumes. Provide structured, concise summaries focusing on key career information.
<|eot_id|>

<|start_header_id|>user<|end_header_id|>
Please analyze this resume and provide a well-structured summary with these sections:

**Personal Information**: Name, contact details, location
**Professional Summary**: Current role, years of experience, key expertise areas
**Core Skills**: Top 5-7 technical/professional skills
**Work Experience**: Recent 2-3 positions with key achievements
**Education**: Highest degree and institution
**Overall Assessment**: Brief strengths and suitability assessment

Resume Content:
{text}

Provide a clear, professional summary in the format above.
<|eot_id|>

<|start_header_id|>assistant<|end_header_id|>
    `);

    try {
      return await this.retryWithBackoff(async () => {
        const chain = await loadSummarizationChain(this.llm, {
          type: "stuff",
          prompt: summaryPrompt,
        });

        // Split text for processing
        const docs = await this.textSplitter.createDocuments([text]);
        
        // Limit chunks for free tier efficiency
        const limitedDocs = docs.slice(0, 2); // Reduced for free tier
        
        if (limitedDocs.length === 1) {
          const result = await chain.call({ input_documents: limitedDocs });
          return result.text;
        } else {
          // For multiple chunks, use map-reduce
          const mapReduceChain = await loadSummarizationChain(this.llm, {
            type: "map_reduce"
          });
          const result = await mapReduceChain.call({ input_documents: limitedDocs });
          return result.text;
        }
      });
    } catch (error) {
      console.error('Error summarizing resume with Llama:', error);
      
      // Check for various API errors
      if (error.message?.includes('429') || 
          error.message?.includes('quota') || 
          error.message?.includes('rate limit') ||
          error.message?.includes('limit exceeded')) {
        console.log('Falling back to basic text analysis due to API limits');
        return this.generateBasicSummary(text);
      }
      
      throw error;
    }
  }

  // Main processing function (same logic as original)
  async processResume(filePath) {
    try {
      console.log('Loading document...');
      const docs = await this.loadDocument(filePath);
      
      console.log('Extracting text...');
      const text = await this.extractText(docs);
      
      if (!text || text.length < 50) {
        throw new Error('Insufficient text content in the document');
      }
      
      console.log(`Generating summary using ${this.provider} (${this.model})...`);
      const summary = await this.summarizeResume(text);
      
      return {
        success: true,
        originalText: text,
        summary: summary,
        wordCount: text.split(' ').length,
        processedAt: new Date().toISOString(),
        processingMode: summary.includes('unavailable') ? 'basic' : 'llama-ai',
        provider: this.provider,
        model: this.model
      };
    } catch (error) {
      console.error('Error processing resume:', error);
      return {
        success: false,
        error: error.message,
        processedAt: new Date().toISOString(),
        provider: this.provider,
        troubleshooting: this.getTroubleshootingTips(error)
      };
    }
  }

  // Enhanced troubleshooting for Llama providers
  getTroubleshootingTips(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return {
        issue: `${this.provider} API Rate/Quota Limit`,
        solutions: [
          `Check your ${this.provider} dashboard for usage limits`,
          'Free tiers have limited requests per day/hour',
          'Consider upgrading to paid tier for higher limits',
          'Implement longer delays between requests',
          'Process files one at a time',
          'Use the basic text analysis as fallback'
        ]
      };
    } else if (errorMessage.includes('api key') || errorMessage.includes('authentication')) {
      return {
        issue: 'API Key Issue',
        solutions: [
          `Verify ${this.provider.toUpperCase()}_API_KEY environment variable is set`,
          `Get a valid API key from ${this.provider}.ai`,
          'Ensure the API key has necessary permissions',
          'Check if the API key is for the correct provider'
        ]
      };
    } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
      return {
        issue: 'Model Not Available',
        solutions: [
          `Verify model "${this.model}" is available on ${this.provider}`,
          'Check the provider\'s model list for available free models',
          'Try switching to a different Llama model variant',
          'Ensure you\'re using the correct model naming convention'
        ]
      };
    }
    
    return {
      issue: 'General Processing Error',
      solutions: [
        'Check file format (PDF/DOCX only)',
        'Ensure file is not corrupted',
        'Try with smaller file size',
        `Verify ${this.provider} service is operational`,
        'Check network connectivity'
      ]
    };
  }

  // Batch processing optimized for free tiers
  async processBatchResumes(filePaths, options = {}) {
    const { 
      concurrency = 1, // Always 1 for free tiers
      delayBetween = 5000 // 5 second delay for free tiers
    } = options;
    
    const results = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      try {
        console.log(`Processing file ${i + 1}/${filePaths.length}: ${path.basename(filePath)}`);
        const result = await this.processResume(filePath);
        results.push({
          filePath,
          fileName: path.basename(filePath),
          ...result
        });
        
        // Longer delay for free tier rate limits
        if (i < filePaths.length - 1 && delayBetween > 0) {
          console.log(`Waiting ${delayBetween}ms before next file (free tier rate limiting)...`);
          await new Promise(resolve => setTimeout(resolve, delayBetween));
        }
      } catch (error) {
        results.push({
          filePath,
          fileName: path.basename(filePath),
          success: false,
          error: error.message,
          processedAt: new Date().toISOString(),
          provider: this.provider,
          troubleshooting: this.getTroubleshootingTips(error)
        });
      }
    }
    
    return {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      provider: this.provider,
      model: this.model,
      results: results
    };
  }
}

// Usage examples:
export const createResumeProcessor = (options) => {
  return new ResumeProcessorLlama(options);
};

// Example configurations for different providers:
export const PROVIDER_CONFIGS = {
  openrouter: {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-8b-instruct:free',
    envVar: 'OPENROUTER_API_KEY'
  },
  groq: {
    provider: 'groq',
    model: 'llama3-8b-8192',
    envVar: 'GROQ_API_KEY'
  },
  together: {
    provider: 'together',
    model: 'meta-llama/Llama-2-7b-chat-hf',
    envVar: 'TOGETHER_API_KEY'
  }
};