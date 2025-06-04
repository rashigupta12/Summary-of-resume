export async function GET(request) {
  const url = new URL(request.url);
  
  if (url.pathname.endsWith('/config')) {
    try {
      const availableProviders = [];
      
      if (process.env.OPENROUTER_API_KEY) {
        availableProviders.push({
          name: 'openrouter',
          displayName: 'OpenRouter',
          models: ['llama-3.3-8b-instruct:free', 'llama-3.1-8b-instruct:free'],
          status: 'available'
        });
      }
      
      if (process.env.GROQ_API_KEY) {
        availableProviders.push({
          name: 'groq',
          displayName: 'Groq',
          models: ['llama3-8b-8192', 'llama3-70b-8192'],
          status: 'available'
        });
      }
      
      if (process.env.TOGETHER_API_KEY) {
        availableProviders.push({
          name: 'together',
          displayName: 'Together AI',
          models: ['meta-llama/Llama-2-7b-chat-hf'],
          status: 'available'
        });
      }

      return NextResponse.json({
        availableProviders,
        defaultProvider: availableProviders[0]?.name || null,
        supportedFileTypes: ['PDF', 'DOCX'],
        maxFileSize: '10MB',
        recommendedFileSize: '5MB',
        rateLimits: PROVIDER_RATE_LIMITS
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to load configuration' },
        { status: 500 }
      );
    }
  }
  
  // Default health check if no specific endpoint
  return GET();
}