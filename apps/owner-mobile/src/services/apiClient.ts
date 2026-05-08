export type ApiClientConfig = {
  baseUrl: string;
};

export function createApiClient(_config: ApiClientConfig) {
  return {
    ready: false,
  };
}
