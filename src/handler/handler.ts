import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { Logger } from '../logger';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  const logger = Logger.getLogger('RequestAPI');

  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'jupyter_fsspec', // API Namespace
    endPoint
  );

  logger.debug('Sending API request', {
    url: requestUrl,
    method: init.method || 'GET',
    headers: init.headers
  });

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);

    logger.debug('Received API response', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
  } catch (error) {
    logger.error('Network error during API request', {
      url: requestUrl,
      error
    });
    throw new ServerConnection.NetworkError(error as any);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      logger.warn('Failed to parse JSON response', {
        status: response.status,
        contentLength: data.length,
        contentPreview: data.substring(0, 100)
      });
    }
  }

  if (!response.ok) {
    logger.error('API request failed', {
      url: requestUrl,
      status: response.status,
      statusText: response.statusText,
      errorData: data.message || data
    });

    if (data.status === 'failed' && data.description) {
      logger.debug('Returning failed status with description', {
        description: data.description
      });
      return data;
    }

    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  logger.debug('API request successful', {
    endpoint: endPoint,
    responseSize:
      typeof data === 'object' ? JSON.stringify(data).length : data.length
  });

  return data;
}
