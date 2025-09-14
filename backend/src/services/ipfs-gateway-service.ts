import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

interface IPFSUploadResult {
  cid: string;
  size: number;
  name: string;
}

interface IPFSPinResult {
  success: boolean;
  cid: string;
  message?: string;
}

class IPFSGatewayService {
  private gatewayUrl: string;
  private apiUrl: string;
  private enabled: boolean;

  constructor() {
    this.gatewayUrl = process.env.IPFS_GATEWAY_URL || '';
    this.apiUrl = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
    this.enabled = process.env.IPFS_PRIVATE_GATEWAY_ENABLED === 'true';
  }

  /**
   * Verifica si la gateway IPFS privada está habilitada
   */
  isEnabled(): boolean {
    return this.enabled && Boolean(this.gatewayUrl) && Boolean(this.apiUrl);
  }

  /**
   * Verifica el estado de la gateway IPFS privada
   */
  async checkGatewayHealth(): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      // Verificar API IPFS local
      const apiResponse = await axios.post(`${this.apiUrl}/api/v0/version`, null, {
        timeout: 10000
      });

      if (apiResponse.status !== 200) return false;

      // Verificar gateway privada
      const gatewayResponse = await axios.get(`${this.gatewayUrl}/health`, {
        timeout: 10000
      });

      return gatewayResponse.status === 200 && gatewayResponse.data.status === 'ok';
    } catch (error) {
      console.error('IPFS Gateway Health Check failed:', error);
      return false;
    }
  }

  /**
   * Sube un archivo a IPFS usando la API local
   */
  async uploadFile(filePath: string, fileName?: string): Promise<IPFSUploadResult> {
    if (!this.isEnabled()) {
      throw new Error('Gateway IPFS privada no está habilitada');
    }

    try {
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      const finalFileName = fileName || path.basename(filePath);

      formData.append('file', fileStream, {
        filename: finalFileName,
        contentType: this.getContentType(filePath)
      });

      const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 300000, // 5 minutos para upload
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const result = response.data;
      
      return {
        cid: result.Hash,
        size: parseInt(result.Size),
        name: result.Name
      };

    } catch (error: any) {
      console.error('Error subiendo archivo a IPFS:', error);
      throw new Error(`Error subiendo a IPFS: ${error.message}`);
    }
  }

  /**
   * Sube múltiples archivos a IPFS
   */
  async uploadFiles(files: Array<{ path: string; name?: string }>): Promise<IPFSUploadResult[]> {
    const results: IPFSUploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file.path, file.name);
        results.push(result);
      } catch (error) {
        console.error(`Error subiendo archivo ${file.path}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Fija un CID en la gateway privada para asegurar disponibilidad
   */
  async pinCID(cid: string): Promise<IPFSPinResult> {
    if (!this.isEnabled()) {
      throw new Error('Gateway IPFS privada no está habilitada');
    }

    try {
      // Pin en nodo local
      await axios.post(`${this.apiUrl}/api/v0/pin/add`, null, {
        params: { arg: cid },
        timeout: 60000
      });

      // Notificar a la gateway privada para sincronización
      if (this.gatewayUrl) {
        try {
          await axios.post(`${this.gatewayUrl}/admin/pin/${cid}`, {}, {
            timeout: 30000
          });
        } catch (gatewayError) {
          console.warn('Error notificando pin a gateway privada:', gatewayError);
          // No fallar si la gateway no responde, el pin local es suficiente
        }
      }

      return {
        success: true,
        cid,
        message: 'CID fijado exitosamente'
      };

    } catch (error: any) {
      console.error('Error fijando CID:', error);
      return {
        success: false,
        cid,
        message: error.message || 'Error desconocido fijando CID'
      };
    }
  }

  /**
   * Descargar archivo desde IPFS usando la gateway privada
   */
  async downloadFile(cid: string, outputPath: string): Promise<boolean> {
    if (!this.isEnabled()) {
      throw new Error('Gateway IPFS privada no está habilitada');
    }

    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/${cid}`, {
        responseType: 'stream',
        timeout: 120000 // 2 minutos
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
      });

    } catch (error: any) {
      console.error('Error descargando archivo desde IPFS:', error);
      throw new Error(`Error descargando desde IPFS: ${error.message}`);
    }
  }

  /**
   * Verifica si un CID existe y es accesible
   */
  async verifyCID(cid: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const response = await axios.head(`${this.gatewayUrl}/ipfs/${cid}`, {
        timeout: 30000
      });

      return response.status === 200;
    } catch (error) {
      console.error(`Error verificando CID ${cid}:`, error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de la gateway IPFS
   */
  async getGatewayStats(): Promise<any> {
    if (!this.isEnabled()) {
      return { enabled: false };
    }

    try {
      // Estadísticas del nodo local
      const repoStats = await axios.post(`${this.apiUrl}/api/v0/repo/stat`, null, {
        timeout: 15000
      });

      // Estadísticas de la gateway privada
      let gatewayStats = {};
      try {
        const gatewayResponse = await axios.get(`${this.gatewayUrl}/metrics`, {
          timeout: 15000
        });
        gatewayStats = gatewayResponse.data;
      } catch (error) {
        console.warn('Error obteniendo estadísticas de gateway:', error);
      }

      return {
        enabled: true,
        healthy: true,
        node: repoStats.data,
        gateway: gatewayStats
      };

    } catch (error: any) {
      console.error('Error obteniendo estadísticas de IPFS:', error);
      return {
        enabled: true,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene el tipo de contenido basado en la extensión del archivo
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: { [key: string]: string } = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Genera URL pública para acceder a un archivo via gateway privada
   */
  getPublicUrl(cid: string): string {
    if (!this.gatewayUrl) {
      throw new Error('Gateway URL no configurada');
    }
    
    return `${this.gatewayUrl}/ipfs/${cid}`;
  }
}

export const ipfsGatewayService = new IPFSGatewayService();
export default ipfsGatewayService;
