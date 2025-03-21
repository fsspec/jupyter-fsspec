import { requestAPI } from './handler';
import { Logger } from '../logger';

/*
interface IFilesystemConfig {
  name: string;
  path: string;
  protocol: 's3' | 'local';
  access_key_env?: string;
  secret_key_env?: string;
}
  */

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    fsspecModel: FsspecModel;
  }
}

export class FsspecModel {
  private readonly logger = Logger.getLogger('FsspecModel');

  activeFilesystem: string = '';
  userFilesystems: any = {};
  retry = 0;

  async initialize(automatic: boolean = true, retry = 3) {
    this.retry = retry;
    if (automatic) {
      // Perform automatic setup: Fetch filesystems from config and store
      // this model on the window as global application state
      this.storeApplicationState();

      // Attempt to read and store user config values
      this.userFilesystems = {};
      try {
        for (let i = 0; i < retry; i++) {
          this.logger.info('Attempting to read config file...', {
            attempt: i + 1
          });
          const result = await this.getStoredFilesystems();
          if (result?.status === 'success') {
            this.logger.info('Successfully retrieved config', {
              filesystems: Object.keys(result.filesystems || {}).length
            });
            this.userFilesystems = result.filesystems;

            // Set active filesystem to first
            if (Object.keys(result).length > 0) {
              this.activeFilesystem = Object.keys(this.userFilesystems)[0];
            }
            break;
          } else {
            this.logger.error('Error fetching filesystems from user config', {
              attempt: i + 1,
              maxRetries: retry
            });
            if (i + 1 < retry) {
              this.logger.info('Retrying config fetch');
            }
          }
        }
      } catch (error) {
        this.logger.error('Unknown error initializing fsspec model', { error });
      }
    }
  }

  // Store model on the window as global app state
  storeApplicationState() {
    window.fsspecModel = this;
    this.logger.debug('Model stored in global state');
  }

  // ====================================================================
  // FileSystem API calls
  // ====================================================================
  setActiveFilesystem(name: string): void {
    this.logger.debug('Setting active filesystem', { name });
    this.activeFilesystem = name;
  }

  getActiveFilesystem(): string {
    return this.activeFilesystem;
  }

  getActiveFilesystemInfo(): string {
    return this.userFilesystems[this.activeFilesystem];
  }

  async refreshConfig() {
    this.userFilesystems = {};
    this.logger.debug('Refresh config requested');
    try {
      for (let i = 0; i < this.retry; i++) {
        this.logger.info('Attempting to read config file...', {
          attempt: i + 1
        });
        const result = await this.getStoredFilesystems();
        if (result?.status === 'success') {
          this.logger.info('Successfully retrieved config', {
            filesystems: Object.keys(result.filesystems || {}).length
          });
          this.userFilesystems = result.filesystems;

          // Set active filesystem to first
          if (Object.keys(result).length > 0) {
            this.activeFilesystem = Object.keys(this.userFilesystems)[0];
          }
          break;
        } else {
          this.logger.error('Error fetching filesystems from user config', {
            attempt: i + 1,
            maxRetries: this.retry
          });
          if (i + 1 < this.retry) {
            this.logger.info('Retrying config fetch');
          }
        }
      }
    } catch (error) {
      this.logger.error('Unknown error initializing fsspec model', { error });
    }
  }

  async getStoredFilesystems(): Promise<any> {
    // Fetch list of filesystems stored in user's config file
    const filesystems: any = {};
    const result = {
      filesystems: filesystems,
      status: 'success'
    };
    try {
      const response = await requestAPI<any>('config');
      this.logger.debug('Request config received', { response });

      if (response?.status === 'success' && response?.content) {
        for (const filesysInfo of response.content) {
          if (filesysInfo?.name) {
            this.logger.debug('Found filesystem', {
              filesystem: filesysInfo.name
            });
            filesystems[filesysInfo.name] = filesysInfo;
          } else {
            this.logger.error('Filesystem from config is missing a name', {
              filesystem: filesysInfo
            });
          }
        }
      } else {
        this.logger.error('Error fetching config from server', {
          status: response?.status
        });
        result.status = 'failure';
      }
    } catch (error) {
      this.logger.error('Unknown error fetching config', { error });
      result.status = 'failure';
    }

    return result;
  }

  async getContent(
    key: string,
    item_path: string,
    type: string = ''
  ): Promise<any> {
    try {
      const query = new URLSearchParams({
        key,
        item_path,
        type
      });
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });
      this.logger.debug('Content retrieved', {
        key,
        path: item_path,
        status: response?.status
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch content', {
        key,
        path: item_path,
        error
      });
      return null;
    }
  }

  async getRangeContent(
    key: string,
    item_path: string,
    type: string = 'range',
    start: number,
    end: number
  ): Promise<any> {
    try {
      const query = new URLSearchParams({
        key,
        item_path,
        type
      });
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET',
        headers: {
          Range: `${start}-${end}`
        }
      });
      this.logger.debug('Range content retrieved', {
        key,
        path: item_path,
        range: `${start}-${end}`,
        status: response?.status
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch range content', {
        key,
        path: item_path,
        range: `${start}-${end}`,
        error
      });
      return null;
    }
  }

  async delete(key: string, item_path: string): Promise<any> {
    try {
      const query = new URLSearchParams({
        key,
        item_path
      });
      const reqBody = JSON.stringify({
        key: key,
        item_path
      });
      const response = await requestAPI<any>(`files?${query.toString()}`, {
        method: 'DELETE',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      this.logger.info('File deleted', {
        key,
        path: item_path,
        status: response?.status
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to delete file', {
        key,
        path: item_path,
        error
      });
      return null;
    }
  }

  async deleteDir(key: string, item_path: string): Promise<any> {
    try {
      const reqBody = JSON.stringify({
        key: key,
        item_path
      });
      const response = await requestAPI<any>('fsspec', {
        method: 'DELETE',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      this.logger.info('Directory deleted', {
        key,
        path: item_path,
        status: response?.status
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to delete directory', {
        key,
        path: item_path,
        error
      });
      return null;
    }
  }

  async post(
    key: string,
    item_path: string,
    content: string,
    base64: boolean
  ): Promise<any> {
    try {
      const query = new URLSearchParams({
        action: 'write',
        key: key
      });

      const reqBody = JSON.stringify({
        key,
        item_path,
        content,
        base64
      });
      const response = await requestAPI<any>(`files?${query.toString()}`, {
        method: 'POST',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      this.logger.info('File created/updated', {
        key,
        path: item_path,
        isBase64: base64,
        contentLength: content.length,
        status: response?.status
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to create/update file', {
        key,
        path: item_path,
        isBase64: base64,
        error
      });
      return null;
    }
  }

  async postDir(
    key: string,
    item_path: string,
    content: string,
    action: string = 'write'
  ): Promise<any> {
    try {
      this.logger.debug('Creating directory', {
        key,
        path: item_path,
        action
      });

      const query = new URLSearchParams({
        action: action
      });
      const reqBody = JSON.stringify({
        key: key,
        item_path,
        content
      });
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'POST',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Directory operation completed', {
        key,
        path: item_path,
        action,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to perform directory operation', {
        key,
        path: item_path,
        action,
        error
      });
      return null;
    }
  }

  async upload(
    key: string,
    local_path: string,
    remote_path: string,
    action: 'upload'
  ): Promise<any> {
    try {
      const query = new URLSearchParams({ action: action });
      const reqBody = JSON.stringify({
        key: key,
        local_path,
        remote_path,
        destination_key: key,
        action: action
      });

      const response = await requestAPI<any>(
        `files/transfer?${query.toString()}`,
        {
          method: 'POST',
          body: reqBody,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.info('File uploaded', {
        key,
        localPath: local_path,
        remotePath: remote_path,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to upload file', {
        key,
        localPath: local_path,
        remotePath: remote_path,
        error
      });
      return null;
    }
  }

  async download(
    key: string,
    remote_path: string,
    local_path: string,
    action: 'download'
  ): Promise<any> {
    try {
      const query = new URLSearchParams({ action: action });
      const reqBody = JSON.stringify({
        key: key,
        remote_path,
        local_path
      });
      const response = await requestAPI<any>(
        `files/transfer?${query.toString()}`,
        {
          method: 'POST',
          body: reqBody,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.info('File downloaded', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to download file', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        error
      });
      return null;
    }
  }

  async sync_push(
    key: string,
    remote_path: string,
    local_path: string
  ): Promise<any> {
    try {
      const reqBody = JSON.stringify({
        key: key,
        remote_path,
        local_path
      });
      const response = await requestAPI<any>('sync', {
        method: 'POST',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Sync push completed (local to remote)', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to sync local to remote', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        error
      });
      return null;
    }
  }

  async sync_pull(
    key: string,
    remote_path: string,
    local_path: string
  ): Promise<any> {
    try {
      const reqBody = JSON.stringify({
        key: key,
        remote_path,
        local_path
      });
      const response = await requestAPI<any>('sync', {
        method: 'GET',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Sync pull completed (remote to local)', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to sync remote to local', {
        key,
        remotePath: remote_path,
        localPath: local_path,
        error
      });
      return null;
    }
  }

  /* TODO: modify, overwrites file entirely*/
  async update(key: string, item_path: string, content: string): Promise<any> {
    try {
      this.logger.debug('Updating file', {
        key,
        path: item_path,
        contentLength: content.length
      });

      const reqBody = JSON.stringify({
        key,
        item_path,
        content
      });
      const response = await requestAPI<any>('fsspec', {
        method: 'PUT',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('File updated', {
        key,
        path: item_path,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to update file', {
        key,
        path: item_path,
        error
      });
      return null;
    }
  }

  async move(
    key: any = 'local%7CSourceDisk%7C.',
    item_path: string,
    content: string
  ): Promise<any> {
    try {
      this.logger.debug('Moving file/directory', {
        key,
        path: item_path,
        destination: content
      });

      const query = new URLSearchParams({
        action: 'move'
      });

      const reqBody = JSON.stringify({
        key,
        item_path,
        content
      });
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'POST',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('File/directory moved', {
        key,
        path: item_path,
        destination: content,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to move file/directory', {
        key,
        path: item_path,
        destination: content,
        error
      });
      return null;
    }
  }

  async listActiveFilesystem(): Promise<any> {
    // Return list of files for active FS
    // Return list of cached file systems?
    if (!this.activeFilesystem) {
      this.logger.error('No active filesystem set');
      throw new Error('No active filesystem set.');
    }
    try {
      const response = await this.walkDirectory(
        this.userFilesystems[this.activeFilesystem].key,
        'find'
      );

      this.logger.debug('Listed active filesystem', {
        filesystem: this.activeFilesystem,
        itemCount: response?.content?.length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to list active filesystem', {
        filesystem: this.activeFilesystem,
        error
      });
      return null;
    }
  }

  // ====================================================================
  // File and Directory API calls
  // ====================================================================
  async getFileContent(path: string, name: string): Promise<any> {
    const query = new URLSearchParams({
      path: path,
      name: name
    });

    try {
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });

      this.logger.debug('File content retrieved', {
        path,
        name,
        contentSize: response?.content?.length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch file content', {
        path,
        name,
        error
      });
      return null;
    }
  }

  async walkDirectory(
    key: string,
    type: string = 'find',
    item_path: string = ''
  ): Promise<any> {
    let query = new URLSearchParams({ key, item_path });
    if (type !== '') {
      query = new URLSearchParams({ key, item_path, type });
    }

    this.logger.debug('Walking directory', {
      key,
      path: item_path,
      type
    });

    try {
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });

      this.logger.debug('Directory walk completed', {
        key,
        path: item_path,
        type,
        itemCount: response?.content?.length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to walk directory', {
        key,
        path: item_path,
        type,
        error
      });
      return null;
    }
  }

  async listDirectory(
    key: string,
    item_path: string = '',
    type: string = 'default'
  ): Promise<any> {
    const query = new URLSearchParams({ key, item_path, type }).toString();

    this.logger.debug('Listing directory', {
      key,
      path: item_path,
      type
    });

    try {
      const result = await requestAPI<any>(`files?${query}`, {
        method: 'GET'
      });

      this.logger.debug('Directory listing completed', {
        key,
        path: item_path,
        itemCount: result?.content?.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to list directory', {
        key,
        path: item_path,
        error
      });
      return null;
    }
  }

  async updateFile(
    path: string,
    recursive: boolean = false,
    backend: string = 'local',
    content: string // Update function for different content
  ): Promise<any> {
    this.logger.debug('Updating file content', {
      path,
      recursive,
      backend,
      contentLength: content.length
    });

    let requestBody: any;

    if (typeof content === 'string') {
      requestBody = content;
    }

    const query = new URLSearchParams({
      path: path,
      backend: backend,
      action: 'write',
      content: requestBody
    });

    this.logger.debug('Update file request prepared', {
      endpoint: `fsspec?${query.toString()}`
    });

    try {
      const response = await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'POST'
      });

      this.logger.info('File updated', {
        path,
        backend,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to update file', {
        path,
        backend,
        error
      });
      return null;
    }
  }

  async copyFile(
    srcPath: string,
    destPath: string,
    recursive: boolean = false,
    backend: string = 'local'
  ): Promise<any> {
    this.logger.debug('Copying file', {
      srcPath,
      destPath,
      recursive,
      backend
    });

    const body = JSON.stringify({
      action: 'copy',
      path: srcPath,
      dest_path: destPath,
      recursive: recursive,
      backend: backend
    });

    try {
      const response = await requestAPI<any>('fsspec', {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('File copied', {
        srcPath,
        destPath,
        recursive,
        backend,
        status: response?.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to copy file', {
        srcPath,
        destPath,
        recursive,
        backend,
        error
      });
      return null;
    }
  }
}
