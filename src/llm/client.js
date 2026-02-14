const { AnthropicProvider } = require('./anthropic');
const { OpenAIProvider } = require('./openai');
const { OllamaProvider } = require('./ollama');

/**
 * Factory function to create LLM client based on config
 * @param {Object} config - LLM configuration
 * @returns {LLMProvider} - Configured LLM provider
 */
function createLLMClient(config) {
  const provider = config.provider || 'anthropic';

  switch (provider.toLowerCase()) {
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      return new AnthropicProvider(config.apiKey, config.model);

    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new OpenAIProvider(config.apiKey, config.model, config.baseUrl);

    case 'ollama':
      return new OllamaProvider(config.model, config.baseUrl);

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

module.exports = { createLLMClient };
