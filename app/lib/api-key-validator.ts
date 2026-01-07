/**
 * API Key validation utilities
 * Tests OpenAI API keys against the actual OpenAI API
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate an OpenAI API key by making a test API call
 * Uses a lightweight endpoint to minimize costs
 */
export async function validateOpenAIApiKeyWithAPI(
  apiKey: string
): Promise<ValidationResult> {
  if (!apiKey || !apiKey.trim()) {
    return {
      isValid: false,
      error: "API key is required",
    };
  }

  const trimmedKey = apiKey.trim();

  // Basic format validation first
  if (!trimmedKey.startsWith("sk-") && !trimmedKey.startsWith("sk-proj-")) {
    return {
      isValid: false,
      error: "Invalid API key format. OpenAI keys start with 'sk-' or 'sk-proj-'",
    };
  }

  try {
    // Make a lightweight API call to validate the key
    // Using the models endpoint as it's cheap and quick
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
      },
    });

    if (response.ok) {
      return {
        isValid: true,
      };
    }

    // Handle specific error cases
    if (response.status === 401) {
      return {
        isValid: false,
        error: "Invalid API key. Please check your key and try again.",
      };
    }

    if (response.status === 403) {
      return {
        isValid: false,
        error: "API key does not have the required permissions.",
      };
    }

    if (response.status === 429) {
      return {
        isValid: false,
        error: "Rate limit exceeded. Please try again in a moment.",
      };
    }

    // Generic error for other status codes
    return {
      isValid: false,
      error: `API validation failed with status ${response.status}`,
    };
  } catch (error) {
    // Network or other errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        isValid: false,
        error: "Network error. Please check your connection and try again.",
      };
    }

    return {
      isValid: false,
      error: "Failed to validate API key. Please try again.",
    };
  }
}
