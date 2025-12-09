// Lightweight fetch-based API helper.
// Keep it dependency-free and browser-compatible.

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface BuildUrlOptions {
  baseUrl?: string;
  query?: QueryParams;
}

export type ResponseType = 'json' | 'text' | 'response';

export interface HttpError extends Error {
  name: 'HttpError';
  status: number;
  statusText: string;
  url: string;
  requestBody?: string;
  responseBody?: string;
}

export interface TimeoutError extends Error {
  name: 'TimeoutError';
  url: string;
}

// Type for JSON-serializable data
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = Array<JsonValue>;

// Type for request body - can be JSON data, FormData, or string
export type RequestBody = JsonValue | FormData | string;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  query?: QueryParams;
  body?: RequestBody;
  timeoutMs?: number;
  baseUrl?: string;
  respType?: ResponseType;
}

// Response type mapping based on respType
export type ApiResponse<T extends ResponseType = 'json'> = T extends 'response'
  ? Response
  : T extends 'text'
    ? string
    : JsonValue;

export interface ApiClient {
  api: <T extends ResponseType = 'json'>(
    path: string,
    options?: ApiOptions,
  ) => Promise<ApiResponse<T>>;
  get: <T extends ResponseType = 'json'>(
    path: string,
    options?: Omit<ApiOptions, 'method'>,
  ) => Promise<ApiResponse<T>>;
  post: <T extends ResponseType = 'json'>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiOptions, 'method' | 'body'>,
  ) => Promise<ApiResponse<T>>;
  put: <T extends ResponseType = 'json'>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiOptions, 'method' | 'body'>,
  ) => Promise<ApiResponse<T>>;
  patch: <T extends ResponseType = 'json'>(
    path: string,
    body?: RequestBody,
    options?: Omit<ApiOptions, 'method' | 'body'>,
  ) => Promise<ApiResponse<T>>;
  del: <T extends ResponseType = 'json'>(
    path: string,
    options?: Omit<ApiOptions, 'method'>,
  ) => Promise<ApiResponse<T>>;
}

/**
 * Convert an object to a query string. Values that are undefined/null are skipped.
 * Arrays are expanded with repeated keys: foo=1&foo=2
 */
export const toQueryString = (params: QueryParams | null | undefined): string =>
  Object.entries(params || {})
    .filter(
      (entry): entry is [string, NonNullable<QueryValue | QueryValue[]>] => {
        const [, value] = entry;
        return value !== undefined && value !== null;
      },
    )
    .flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((iv) => [k, iv] as const) : [[k, v] as const],
    )
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');

/**
 * Build a URL with optional base and query params.
 */
export const buildUrl = (
  url: string,
  { baseUrl, query }: BuildUrlOptions = {},
): string => {
  const full = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    : url;
  if (!query || Object.keys(query).length === 0) return full;
  const qs = toQueryString(query);
  if (!qs) return full;
  return full.includes('?') ? `${full}&${qs}` : `${full}?${qs}`;
};

/**
 * Normalize a fetch Response to JSON or text depending on content-type and caller preference.
 */
const parseResponse = async <T extends ResponseType>(
  res: Response,
  respType: T,
): Promise<ApiResponse<T>> => {
  if (respType === 'response') return res as ApiResponse<T>; // return raw Response
  if (respType === 'text') return (await res.text()) as ApiResponse<T>;
  const contentType = res.headers.get('content-type') || '';
  if (respType === 'json' || contentType.includes('application/json')) {
    // If body is empty, res.json() would throw; handle gracefully.
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as ApiResponse<T>;
  }
  return (await res.text()) as ApiResponse<T>;
};

/**
 * Create an Error with useful context without leaking sensitive data.
 */
const createHttpError = (
  message: string,
  {
    status,
    statusText,
    url,
    body,
    responseBody,
  }: {
    status: number;
    statusText: string;
    url: string;
    body?: string;
    responseBody?: string;
  },
): HttpError => {
  const err = new Error(message) as HttpError;
  err.name = 'HttpError';
  err.status = status;
  err.statusText = statusText;
  err.url = url;
  // Include minimal, non-sensitive request/response snippets for debugging
  err.requestBody = body && body.length <= 512 ? body : undefined;
  err.responseBody =
    responseBody && responseBody.length <= 1024 ? responseBody : undefined;
  return err;
};

/**
 * Fetch wrapper with JSON handling, timeout via AbortController, query params, and small ergonomics.
 *
 * @param url - Path or full URL
 * @param options - Request options
 * @returns Promise resolving to the response data
 */
export const api = async <T extends ResponseType = 'json'>(
  url: string,
  {
    method = 'GET',
    headers = {},
    query,
    body,
    timeoutMs = 15000,
    baseUrl,
    respType,
  }: ApiOptions = {},
): Promise<ApiResponse<T>> => {
  const actualRespType = (respType ?? 'json') as T;
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const id = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  const isJsonBody =
    body !== undefined && body !== null && !(body instanceof FormData);
  const defaultHeaders: Record<string, string> = isJsonBody
    ? { 'Content-Type': 'application/json', Accept: 'application/json' }
    : { Accept: 'application/json' };
  const finalHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...headers,
  };

  const requestUrl = buildUrl(url, { baseUrl, query });
  const requestInit: RequestInit = {
    method,
    headers: finalHeaders,
    body:
      method === 'GET' || method === 'HEAD'
        ? undefined
        : isJsonBody
          ? JSON.stringify(body)
          : (body as BodyInit),
    signal: controller?.signal,
    credentials: 'same-origin',
  };

  try {
    const res = await fetch(requestUrl, requestInit);
    if (!res.ok) {
      const respText = await res.text().catch(() => '');
      throw createHttpError('Request failed', {
        status: res.status,
        statusText: res.statusText,
        url: requestUrl,
        body:
          typeof requestInit.body === 'string' ? requestInit.body : undefined,
        responseBody: respText,
      });
    }
    return await parseResponse<T>(res, actualRespType);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      const err = new Error('Request timeout') as TimeoutError;
      err.name = 'TimeoutError';
      err.url = requestUrl;
      throw err;
    }
    throw e;
  } finally {
    if (id) clearTimeout(id);
  }
};

// Convenience method wrappers
export const get = <T extends ResponseType = 'json'>(
  url: string,
  opts: Omit<ApiOptions, 'method'> = {},
): Promise<ApiResponse<T>> => api<T>(url, { ...opts, method: 'GET' });

export const post = <T extends ResponseType = 'json'>(
  url: string,
  body?: RequestBody,
  opts: Omit<ApiOptions, 'method' | 'body'> = {},
): Promise<ApiResponse<T>> => api<T>(url, { ...opts, method: 'POST', body });

export const put = <T extends ResponseType = 'json'>(
  url: string,
  body?: RequestBody,
  opts: Omit<ApiOptions, 'method' | 'body'> = {},
): Promise<ApiResponse<T>> => api<T>(url, { ...opts, method: 'PUT', body });

export const patch = <T extends ResponseType = 'json'>(
  url: string,
  body?: RequestBody,
  opts: Omit<ApiOptions, 'method' | 'body'> = {},
): Promise<ApiResponse<T>> => api<T>(url, { ...opts, method: 'PATCH', body });

export const del = <T extends ResponseType = 'json'>(
  url: string,
  opts: Omit<ApiOptions, 'method'> = {},
): Promise<ApiResponse<T>> => api<T>(url, { ...opts, method: 'DELETE' });

/**
 * Factory to bind a baseUrl and/or default options.
 */
export const createApi = (
  baseUrl?: string,
  defaultOptions: ApiOptions = {},
): ApiClient => {
  const call = <T extends ResponseType = 'json'>(
    path: string,
    options: ApiOptions = {},
  ): Promise<ApiResponse<T>> =>
    api<T>(path, { baseUrl, ...defaultOptions, ...options });

  return {
    api: call,
    get: <T extends ResponseType = 'json'>(
      path: string,
      options: Omit<ApiOptions, 'method'> = {},
    ) => call<T>(path, { ...options, method: 'GET' }),
    post: <T extends ResponseType = 'json'>(
      path: string,
      body?: RequestBody,
      options: Omit<ApiOptions, 'method' | 'body'> = {},
    ) => call<T>(path, { ...options, method: 'POST', body }),
    put: <T extends ResponseType = 'json'>(
      path: string,
      body?: RequestBody,
      options: Omit<ApiOptions, 'method' | 'body'> = {},
    ) => call<T>(path, { ...options, method: 'PUT', body }),
    patch: <T extends ResponseType = 'json'>(
      path: string,
      body?: RequestBody,
      options: Omit<ApiOptions, 'method' | 'body'> = {},
    ) => call<T>(path, { ...options, method: 'PATCH', body }),
    del: <T extends ResponseType = 'json'>(
      path: string,
      options: Omit<ApiOptions, 'method'> = {},
    ) => call<T>(path, { ...options, method: 'DELETE' }),
  };
};

export const apiClient = createApi(process.env.APP_URL);
