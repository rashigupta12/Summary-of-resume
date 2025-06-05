// utils/uploadthingClient.tsx
'use client';

import { ourFileRouter } from '../app/api/uploadthing/core';
import { generateReactHelpers } from "@uploadthing/react";
// import { UploadButton, UploadDropzone } from '@uploadthing/react';


// Export the standard UploadThing components for client usage
export const { useUploadThing, uploadFiles } = 
  generateReactHelpers<typeof ourFileRouter>();
// Custom UploadThing client for folder operations
class UploadThingClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor() {
    // Get API key from environment variable
    this.apiKey = process.env.UPLOADTHING_API_KEY || "";
    this.baseUrl = "https://api.uploadthing.com";
  }

  /**
   * Create a new folder in UploadThing
   */
  async createFolder({ 
    name, 
    parentFolderId = null 
  }: { 
    name: string; 
    parentFolderId?: string | null 
  }) {
    try {
      const response = await fetch(`${this.baseUrl}/api/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
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

  /**
   * Get folder details by folder ID
   */
  async getFolder(folderId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/api/folders/${folderId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
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

  /**
   * List all folders or subfolders within a specific folder
   */
  async listFolders(parentFolderId?: string) {
    try {
      const endpoint = parentFolderId 
        ? `${this.baseUrl}/api/folders/${parentFolderId}/folders` 
        : `${this.baseUrl}/api/folders`;
      
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
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

  /**
   * List files within a folder
   */
  async listFiles(folderId?: string) {
    try {
      const endpoint = folderId 
        ? `${this.baseUrl}/api/folders/${folderId}/files` 
        : `${this.baseUrl}/api/files`;
      
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to list files: ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error listing files from UploadThing:", error);
      throw error;
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/api/folders/${folderId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete folder: ${errorData.message || response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error("Error deleting folder from UploadThing:", error);
      throw error;
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderId: string, newName: string) {
    try {
      const response = await fetch(`${this.baseUrl}/api/folders/${folderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name: newName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to rename folder: ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error renaming folder in UploadThing:", error);
      throw error;
    }
  }

  /**
   * Move files to a specific folder
   */
  async moveFilesToFolder(fileIds: string[], targetFolderId: string | null) {
    try {
      const response = await fetch(`${this.baseUrl}/api/files/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          fileIds,
          folderId: targetFolderId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to move files: ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error moving files in UploadThing:", error);
      throw error;
    }
  }
}

// Export the client instance
export const uploadthingClient = new UploadThingClient();