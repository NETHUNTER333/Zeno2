import {
  Keenable,
  KeenableAPIError,
  KeenableAuthError,
  KeenableRateLimitError,
  type SearchOptions,
  type SearchResult,
} from 'keenable';

/**
 * Searches the web using the Keenable TypeScript SDK.
 * Reads KEENABLE_API_KEY from environment variables (never hardcoded).
 *
 * Status code handling:
 * - 401: API key is wrong; throws immediately without guessing another key.
 * - 402: Organization is out of requests; instructs to top up at https://app.keenable.ai/console/billing.
 * - 429: Waits 1 second and retries once.
 */
export async function searchKeenable(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const client = new Keenable();

  const execute = async (): Promise<SearchResult[]> => {
    const response = await client.search(query, options);
    return response.results;
  };

  try {
    return await execute();
  } catch (err) {
    if (
      err instanceof KeenableRateLimitError ||
      (err instanceof KeenableAPIError && err.statusCode === 429)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await execute();
    }

    if (
      err instanceof KeenableAuthError ||
      (err instanceof KeenableAPIError && err.statusCode === 401)
    ) {
      const authError = new Error(
        'Keenable API returned 401 Unauthorized: KEENABLE_API_KEY is wrong or invalid.'
      );
      (authError as any).statusCode = 401;
      throw authError;
    }

    if (err instanceof KeenableAPIError && err.statusCode === 402) {
      const billingError = new Error(
        'Keenable API returned 402 Payment Required: Organization is out of requests. Please top up at https://app.keenable.ai/console/billing'
      );
      (billingError as any).statusCode = 402;
      throw billingError;
    }

    throw err;
  }
}
