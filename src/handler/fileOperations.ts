import { requestAPI } from './handler';
import { Logger } from '../logger';

/*
interface IFilesystemConfig {
  name: string;
  path: string;
  type: 's3' | 'local';
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
          Logger.info('[FSSpec] Attempting to read config file...');
          const result = await this.getStoredFilesystems();
          if (result?.status === 'success') {
            // TODO report config entry errors
            Logger.info(
              `[FSSpec] Successfully retrieved config:${JSON.stringify(result)}`
            );
            this.userFilesystems = result.filesystems;

            // Set active filesystem to first
            if (Object.keys(result).length > 0) {
              this.activeFilesystem = Object.keys(this.userFilesystems)[0];
            }
            break;
          } else {
            // TODO handle no config file
            Logger.error(
              '[FSSpec] Error fetching filesystems from user config'
            );
            if (i + 1 < retry) {
              Logger.info('[FSSpec]   retrying...');
            }
          }
        }
      } catch (error) {
        Logger.error(
          `[FSSpec] Error: Unknown error initializing fsspec model:\n${error}`
        );
      }
    }
  }

  // Store model on the window as global app state
  storeApplicationState() {
    window.fsspecModel = this;
  }

  // ====================================================================
  // FileSystem API calls
  // ====================================================================
  setActiveFilesystem(name: string): void {
    this.activeFilesystem = name;
  }

  getActiveFilesystem(): string {
    return this.activeFilesystem;
  }

  getActiveFilesystemInfo(): string {
    return this.userFilesystems[this.activeFilesystem];
  }

  async refreshConfig() {
    // TODO fix/refactor
    this.userFilesystems = {};
    Logger.debug('aaa');
    Logger.debug(`[FSSpec] Refresh config requested`);
    try {
      Logger.debug('bbb');
      for (let i = 0; i < this.retry; i++) {
        Logger.debug('ccc');
        Logger.info('[FSSpec] Attempting to read config file...');
        const result = await this.getStoredFilesystems();  // This is a result dict, not a response
        if (result?.status === 'success') {
          // TODO report config entry errors
          Logger.info(
            `[FSSpec] Successfully retrieved config:${JSON.stringify(result)}`
          );
          this.userFilesystems = result.filesystems;

          // Set active filesystem to first
          if (Object.keys(result).length > 0) {
            this.activeFilesystem = Object.keys(this.userFilesystems)[0];
            Logger.debug('ddd');
          }
          break;
        } else {
          Logger.debug('eee');
          // TODO handle no config file
          Logger.error('[FSSpec] Error fetching filesystems from user config');
          if (i + 1 < this.retry) {
            Logger.info('[FSSpec]   retrying...');
            Logger.debug('fffr');
          }
        }
      }
    } catch (error) {
      Logger.error(
        `[FSSpec] Error: Unknown error initializing fsspec model:\n${error}`
      );
    }
    Logger.debug('zzz');
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
      Logger.debug(`[FSSpec] Request config:\n${JSON.stringify(response)}`);
      if (response?.status === 'success' && response?.content) {
        for (const filesysInfo of response.content) {
          if (filesysInfo?.name) {
            Logger.debug(
              `[FSSpec] Found filesystem: ${JSON.stringify(filesysInfo)}`
            );
            filesystems[filesysInfo.name] = filesysInfo;
          } else {
            // TODO better handling for partial errors
            Logger.error(
              `[FSSpec] Error, filesystem from config is missing a name: ${filesysInfo}`
            );
          }
        }
      } else {
        Logger.error('[FSSpec] Error fetching config from server...');
        result.status = 'failure';
      }
      // // const fetchedFilesystems = response['content'];
      // // console.log(fetchedFilesystems);
      // // Map names to filesys metadata
      // for (const filesysInfo of fetchedFilesystems) {
      //   if ('name' in filesysInfo) {
      //     filesystems[filesysInfo.name] = filesysInfo;
      //   } else {
      //     console.error(
      //       `Filesystem from config is missing a name: ${filesysInfo}`
      //     );
      //   }
      // }
    } catch (error) {
      Logger.error(`[FSSpec] Error: Unknown error fetching config:\n${error}`);
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to fetch filysystems: ', error);
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to fetch filysystems: ', error);
      return null;
    }
  }

  async delete(key: string, item_path: string): Promise<any> {
    try {
      const reqBody = JSON.stringify({
        key,
        item_path
      });
      const response = await requestAPI<any>('fsspec', {
        method: 'DELETE',
        body: reqBody,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to delete: ', error);
      return null;
    }
  }

  async delete_refactored(key: string, item_path: string): Promise<any> {
    try {
      const query = new URLSearchParams({
        key,
        item_path
      });
      const response = await requestAPI<any>(`files?${query.toString()}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to delete: ', error);
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to delete: ', error);
      return null;
    }
  }

  async post(key: string, item_path: string, content: string): Promise<any> {
    try {
      const query = new URLSearchParams({
        action: 'write'
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to post: ', error);
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
      console.log('postDir');
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to post: ', error);
      return null;
    }
  }

  // async update(
  //   key: any = 'local%7CSourceDisk%7C.',
  //   item_path = '',
  //   content = ''
  // ): Promise<any> {
  //   try {
  //     console.log('postDir');
  //     const reqBody = JSON.stringify({
  //       key: key,
  //       item_path:
  //         '/Users/rosioreyes/Desktop/notebooks/eg_notebooks/sample_dir',
  //       content: 'fsspec_generated_folder'
  //     });
  //     const response = await requestAPI<any>('fsspec', {
  //       method: 'PUT',
  //       body: reqBody,
  //       headers: {
  //         'Content-Type': 'application/json'
  //       }
  //     });
  //     console.log('response is: ', response);
  //   } catch (error) {
  //     console.error('Failed to post: ', error);
  //     return null;
  //   }
  // }

  /* TODO: modify, overwrites file entirely*/
  async update(key: string, item_path: string, content: string): Promise<any> {
    try {
      console.log('postDir');
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to post: ', error);
      return null;
    }
  }

  async move(
    key: any = 'local%7CSourceDisk%7C.',
    item_path: string,
    content: string
  ): Promise<any> {
    try {
      console.log('postDir');
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
      console.log('response is: ', response);
    } catch (error) {
      console.error('Failed to post: ', error);
      return null;
    }
  }

  async listActiveFilesystem(): Promise<any> {
    // Return list of files for active FS
    // Return list of cached file systems?
    if (!this.activeFilesystem) {
      throw new Error('No active filesystem set.');
    }
    try {
      return await this.walkDirectory(
        this.userFilesystems[this.activeFilesystem].key,
        'find'
      );
    } catch (error) {
      console.error('Failed to list currently active file system: ', error);
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
      return await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error(`Failed to fetch file content at ${path}: `, error);
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
    try {
      return await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error(`Failed to list filesystem ${key}: `, error);
      return null;
    }
  }

  async listDirectory(
    key: string,
    item_path: string = '',
    type: string = 'default'
  ): Promise<any> {
    const query = new URLSearchParams({ key, item_path, type }).toString();
    let result = null;

    Logger.debug(`[FSSpec] Fetching files -> ${query}`);
    try {
      result = await requestAPI<any>(`files?${query}`, {
        method: 'GET'
      });
    } catch (error) {
      Logger.error(`[FSSpec] Failed to list filesystem ${error}: `);
    }

    return result;
  }

  async updateFile(
    path: string,
    recursive: boolean = false,
    backend: string = 'local',
    content: string // Update function for different content
  ): Promise<any> {
    console.log('updateFile function');
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
    console.log('endpoint is: ');
    console.log(`fsspec?${query.toString()}`);
    try {
      return await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error(`Failed to update file at ${path}: `, path);
      return null;
    }
  }

  async copyFile(
    srcPath: string,
    destPath: string,
    recursive: boolean = false,
    backend: string = 'local'
  ): Promise<any> {
    const body = JSON.stringify({
      action: 'copy',
      path: srcPath,
      dest_path: destPath,
      recursive: recursive,
      backend: backend
    });

    try {
      return await requestAPI<any>('fsspec', {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error(`Failed to copy file ${srcPath} to ${destPath}: `, error);
      return null;
    }
  }
}
