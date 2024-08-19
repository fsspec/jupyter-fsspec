import { requestAPI } from './handler';

export async function getFileContent(
  path: string,
  backend: string = 'local'
): Promise<any> {
  const query = new URLSearchParams({
    path: path,
    backend: backend,
    action: 'read'
  });

  return await requestAPI<any>(`fsspec?${query.toString()}`, {
    method: 'GET'
  });
}

export async function listDirectory(
  path: string,
  backend: string = 'local'
): Promise<any> {
  console.log('hitting handler function');
  const query = new URLSearchParams({
    path: path,
    backend: backend,
    action: 'list'
  });
  console.log('endpoint is: ');
  console.log(`fsspec?${query.toString()}`);
  return await requestAPI<any>(`fsspec?${query.toString()}`, {
    method: 'GET'
  });
}

export async function copyFile(
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

  return await requestAPI<any>('fsspec', {
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
