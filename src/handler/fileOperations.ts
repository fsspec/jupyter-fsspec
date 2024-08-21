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
  filesystemList: any;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      this.filesystemList = await this.getStoredFilesystems();
      console.log('filesystem list is: ', this.filesystemList);
      /* Optional to set first filesystem as active.
      if (this.filesystemList.length > 0) {
        this.activeFilesystem = this.filesystemList[0].name;
      }
      */
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
    try {
      const filesystems = await requestAPI<any>('fsspec-config');
      return filesystems || [];
    } catch (error) {
      console.error('Failed to fetch filysystems: ', error);
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
      return await this.listDirectory(this.activeFilesystem);
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

  async listDirectory(name: string, path: string = ''): Promise<any> {
    const query = new URLSearchParams({ name, path, action: 'list' });

    try {
      return await requestAPI<any>(`fsspec?${query.toString()}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error(`Failed to list filesystem ${name}: `, error);
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
