// Gofile API Configuration
const GOFILE_ACCOUNT_ID = '8f8c8a9e-4983-4808-b71d-b821e00b3cfc';
const GOFILE_API_TOKEN = 'wWHmatiFC2avPaKdLawWZlCAQfQEOqcm';
const GOFILE_API_BASE = 'https://api.gofile.io';
const GOFILE_UPLOAD_BASE = 'https://upload.gofile.io';

export interface GofileUploadResult {
  success: boolean;
  fileId: string;
  downloadPage: string;
  fileName: string;
  parentFolder: string;
}

export interface GofileFileInfo {
  id: string;
  name: string;
  size: number;
  downloadCount: number;
  link: string;
  directLink: string;
  type: 'file' | 'folder';
}

/**
 * Upload a file to Gofile and return the file ID
 */
export async function uploadToGofile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<GofileUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // Upload to Gofile
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', async () => {
        console.log('Gofile upload response status:', xhr.status);
        console.log('Gofile upload response:', xhr.responseText);
        
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log('Gofile parsed response:', response);
            
            if (response.status === 'ok' && response.data) {
              // Extract file information - note: Gofile uses 'id' not 'fileId'
              const fileId = response.data.id || response.data.fileId;
              const downloadPage = response.data.downloadPage;
              const fileName = response.data.fileName || response.data.name || file.name;
              const parentFolder = response.data.parentFolder;

              console.log('Gofile upload successful!');
              console.log('  - File ID:', fileId);
              console.log('  - Download page:', downloadPage);
              console.log('  - File name:', fileName);
              console.log('  - Parent folder:', parentFolder);

              if (!fileId) {
                console.error('Missing file ID in response:', response);
                reject(new Error('Upload succeeded but no file ID returned'));
                return;
              }

              resolve({
                success: true,
                fileId,
                downloadPage,
                fileName,
                parentFolder
              });
            } else {
              console.error('Gofile upload failed:', response);
              reject(new Error(response.message || 'Upload failed'));
            }
          } catch (parseError) {
            console.error('Failed to parse Gofile response:', parseError);
            reject(new Error('Invalid response from Gofile'));
          }
        } else {
          console.error('Gofile upload HTTP error:', xhr.status, xhr.statusText);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        console.error('Gofile upload network error');
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', `${GOFILE_UPLOAD_BASE}/uploadfile`);
      xhr.setRequestHeader('Authorization', `Bearer ${GOFILE_API_TOKEN}`);
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Gofile upload error:', error);
    throw error;
  }
}

/**
 * Get file/folder information from Gofile
 * Note: The content API uses query parameter authentication, not Bearer token
 */
export async function getGofileContent(contentId: string): Promise<any> {
  try {
    // Gofile's content API uses token as a query parameter
    const url = `${GOFILE_API_BASE}/contents/${contentId}?token=${GOFILE_API_TOKEN}`;
    
    console.log('Fetching Gofile content for ID:', contentId);
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gofile content API error:', response.status, errorText);
      throw new Error(`Failed to get content: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gofile content response:', data);
    
    if (data.status === 'ok') {
      return data.data;
    } else {
      throw new Error(data.message || 'Failed to get content');
    }
  } catch (error) {
    console.error('Error getting Gofile content:', error);
    throw error;
  }
}

/**
 * Create a direct link for a file
 */
export async function createDirectLink(
  contentId: string,
  options?: {
    expireTime?: number;
    sourceIpsAllowed?: string[];
    domainsAllowed?: string[];
  }
): Promise<string> {
  try {
    const response = await fetch(
      `${GOFILE_API_BASE}/contents/${contentId}/directlinks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GOFILE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options || {})
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create direct link: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'ok' && data.data?.directLink) {
      return data.data.directLink;
    } else {
      throw new Error(data.message || 'Failed to create direct link');
    }
  } catch (error) {
    console.error('Error creating direct link:', error);
    throw error;
  }
}

/**
 * Delete content from Gofile
 */
export async function deleteGofileContent(contentIds: string[]): Promise<boolean> {
  try {
    const response = await fetch(`${GOFILE_API_BASE}/contents`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${GOFILE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentsId: contentIds.join(',')
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete content: ${response.status}`);
    }

    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.error('Error deleting Gofile content:', error);
    throw error;
  }
}

/**
 * Extract file ID from various Gofile URL formats
 */
export function extractGofileId(url: string): string | null {
  // Handle direct file IDs
  if (!url.includes('/') && !url.includes('http')) {
    return url;
  }

  // Handle Gofile download page URLs (gofile.io/d/XXXXXX)
  const downloadPageMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/);
  if (downloadPageMatch) {
    return downloadPageMatch[1];
  }

  // Handle direct links
  const directLinkMatch = url.match(/\/([a-zA-Z0-9]+)$/);
  if (directLinkMatch) {
    return directLinkMatch[1];
  }

  return null;
}