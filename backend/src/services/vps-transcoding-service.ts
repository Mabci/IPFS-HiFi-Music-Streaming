import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

interface TranscodingJobData {
  jobId: string;
  userId: string;
  albumData: {
    title: string;
    description: string;
    year: number;
    genre: string;
    artistName: string;
    tracks: Array<{
      title: string;
      trackNumber: number;
      filePath: string;
      originalFilename: string;
    }>;
    coverImagePath?: string;
  };
  tempUploadPath: string;
}

interface VPSTranscodingResponse {
  success: boolean;
  jobId: string;
  message: string;
  estimatedTime?: number;
}

class VPSTranscodingService {
  private vpsUrl: string;
  private apiKey: string;
  private enabled: boolean;

  constructor() {
    this.vpsUrl = process.env.VPS_TRANSCODING_URL || '';
    this.apiKey = process.env.VPS_API_KEY || '';
    this.enabled = process.env.VPS_ENABLED === 'true';
  }

  /**
   * Verifica si el VPS está disponible y configurado
   */
  isEnabled(): boolean {
    return this.enabled && Boolean(this.vpsUrl) && Boolean(this.apiKey);
  }

  /**
   * Verifica el estado del VPS de transcodificación
   */
  async checkVPSHealth(): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const response = await axios.get(`${this.vpsUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.status === 200 && response.data.status === 'ok';
    } catch (error) {
      console.error('VPS Health Check failed:', error);
      return false;
    }
  }

  /**
   * Envía un trabajo de transcodificación al VPS
   */
  async submitTranscodingJob(jobData: TranscodingJobData): Promise<VPSTranscodingResponse> {
    if (!this.isEnabled()) {
      throw new Error('VPS de transcodificación no está habilitado');
    }

    try {
      const formData = new FormData();
      
      // Metadatos del trabajo
      formData.append('jobId', jobData.jobId);
      formData.append('userId', jobData.userId);
      formData.append('albumData', JSON.stringify(jobData.albumData));

      // Subir archivos de audio
      for (const track of jobData.albumData.tracks) {
        const filePath = path.join(jobData.tempUploadPath, track.filePath);
        if (fs.existsSync(filePath)) {
          formData.append('audioFiles', fs.createReadStream(filePath), {
            filename: track.originalFilename,
            contentType: 'audio/mpeg'
          });
        }
      }

      // Subir imagen de portada si existe
      if (jobData.albumData.coverImagePath) {
        const coverPath = path.join(jobData.tempUploadPath, jobData.albumData.coverImagePath);
        if (fs.existsSync(coverPath)) {
          formData.append('coverImage', fs.createReadStream(coverPath), {
            filename: 'cover.jpg',
            contentType: 'image/jpeg'
          });
        }
      }

      const response = await axios.post(`${this.vpsUrl}/api/transcode`, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 300000, // 5 minutos para upload
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      return {
        success: true,
        jobId: response.data.jobId,
        message: response.data.message || 'Trabajo enviado exitosamente',
        estimatedTime: response.data.estimatedTime
      };

    } catch (error: any) {
      console.error('Error enviando trabajo al VPS:', error);
      
      return {
        success: false,
        jobId: jobData.jobId,
        message: error.response?.data?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Consulta el estado de un trabajo en el VPS
   */
  async getJobStatus(jobId: string): Promise<any> {
    if (!this.isEnabled()) {
      throw new Error('VPS de transcodificación no está habilitado');
    }

    try {
      const response = await axios.get(`${this.vpsUrl}/api/job/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error: any) {
      console.error('Error consultando estado del trabajo:', error);
      throw new Error(error.response?.data?.message || 'Error consultando estado');
    }
  }

  /**
   * Cancela un trabajo en el VPS
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.isEnabled()) {
      throw new Error('VPS de transcodificación no está habilitado');
    }

    try {
      const response = await axios.delete(`${this.vpsUrl}/api/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.status === 200;
    } catch (error: any) {
      console.error('Error cancelando trabajo:', error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas del VPS
   */
  async getVPSStats(): Promise<any> {
    if (!this.isEnabled()) {
      return { enabled: false };
    }

    try {
      const response = await axios.get(`${this.vpsUrl}/api/stats`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return {
        enabled: true,
        healthy: true,
        ...response.data
      };
    } catch (error: any) {
      console.error('Error obteniendo estadísticas del VPS:', error);
      return {
        enabled: true,
        healthy: false,
        error: error.message
      };
    }
  }
}

export const vpsTranscodingService = new VPSTranscodingService();
export default vpsTranscodingService;
