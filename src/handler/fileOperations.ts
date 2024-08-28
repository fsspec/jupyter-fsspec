import { requestAPI } from './handler';

/*
interface IFilesystemConfig {
  name: string;
  path: string;
  type: 's3' | 'local';
  access_key_env?: string;
  secret_key_env?: string;
}
  */

export class FsspecModel {
  activeFilesystem: string = '';
  userFilesystems: any = {};

  constructor() {
    // this.initialize();
  }

  async initialize() {
    try {
      this.userFilesystems = await this.getStoredFilesystems();
      console.log('filesystem list is: ', JSON.stringify(this.userFilesystems));
      // Optional to set first filesystem as active.
      if (Object.keys(this.userFilesystems).length > 0) {
        this.activeFilesystem = Object.keys(this.userFilesystems)[0];
      }
    } catch (error) {
      console.error('Failed to initialized FsspecModel: ', error);
    }
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

  async getStoredFilesystems(): Promise<any> {
    // Fetch list of filesystems stored in user's config file
    const filesystems: any = {};
    try {
      const fetchedFilesystems = await requestAPI<any>('config');
      console.log('Fetch FSs');
      console.log(fetchedFilesystems);

      // Map names to filesys metadata
      for (const filesysInfo of fetchedFilesystems.filesystems) {
        if ('name' in filesysInfo) {
          filesystems[filesysInfo.name] = filesysInfo;
        } else {
          console.error(
            `Filesystem from config is missing a name: ${filesysInfo}`
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch filesystems: ', error);
    }
    console.log(
      `getStoredFilesystems Returns: \n${JSON.stringify(filesystems)}`
    );
    return filesystems;
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
      console.log('post');
      const reqBody = JSON.stringify({
        key,
        item_path,
        content
      });
      const response = await requestAPI<any>('fsspec', {
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

  async listDirectory(key: string, item_path: string = ''): Promise<any> {
    const query = new URLSearchParams({ key, item_path });

    try {
      return await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error(`Failed to list filesystem ${key}: `, error);
      return null;
    }
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
