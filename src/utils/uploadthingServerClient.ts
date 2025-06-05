// utils/uploadthingServerClient.ts

// Note: No 'use server' at the top level of the file

const apiKey = process.env.UPLOADTHING_API_KEY || "";
const baseUrl = "https://api.uploadthing.com";

// Export individual server actions instead of a class instance
export async function createFolder({ 
  name, 
  parentFolderId = null 
}: { 
  name: string; 
  parentFolderId?: string | null 
}) {
  'use server'; // This marks just this function as a server action
  
  try {
    const response = await fetch(`${baseUrl}/api/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        name,
        ...(parentFolderId && { parentId: parentFolderId })
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("UploadThing folder creation failed:", errorData);
      throw new Error(`Failed to create folder: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      folderId: data.id,
      name: data.name,
      createdAt: data.createdAt,
      ...data
    };
  } catch (error) {
    console.error("Error creating folder in UploadThing:", error);
    throw error;
  }
}

// Add other methods as needed - each with their own 'use server' directive
export async function getFolder(folderId: string) {
  'use server';
  
  try {
    const response = await fetch(`${baseUrl}/api/folders/${folderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get folder: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting folder from UploadThing:", error);
    throw error;
  }
}

export async function listFolders(parentFolderId?: string) {
  'use server';
  
  try {
    const endpoint = parentFolderId 
      ? `${baseUrl}/api/folders/${parentFolderId}/folders` 
      : `${baseUrl}/api/folders`;
    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to list folders: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error listing folders from UploadThing:", error);
    throw error;
  }
}