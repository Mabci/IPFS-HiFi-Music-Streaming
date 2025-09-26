'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Clock, Upload, Music, Disc, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useContextualUrl } from '../lib/hooks/useSubdomain';

interface UploadProgressProps {
  jobId: string;
  userId: string;
  albumTitle: string;
  onComplete?: (success: boolean, albumId?: string) => void;
  onError?: (error: string) => void;
}

interface JobUpdate {
  type: string;
  jobId: string;
  progress?: number;
  status?: string;
  message?: string;
  timestamp: string;
}

interface JobCompleted {
  type: string;
  jobId: string;
  success: boolean;
  albumId?: string;
  error?: string;
  timestamp: string;
}

export default function UploadProgress({ 
  jobId, 
  userId, 
  albumTitle, 
  onComplete, 
  onError 
}: UploadProgressProps) {
  const { backendUrl } = useContextualUrl();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando...');
  const [stage, setStage] = useState('upload');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Conectar a WebSocket usando URL contextual
    console.log('🔌 Intentando conectar WebSocket a:', backendUrl);
    console.log('🔌 UserID:', userId, 'JobID:', jobId);

    socketRef.current = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Conectado a WebSocket');
      addLog('Conectado al servidor de progreso');
      
      // Autenticar usuario
      socket.emit('authenticate', { userId });
      
      // Suscribirse a actualizaciones del trabajo
      socket.emit('subscribe_job', { jobId });
    });

    socket.on('authenticated', (data) => {
      if (data.success) {
        addLog('Usuario autenticado correctamente');
      }
    });

    socket.on('authentication_error', (data) => {
      console.error('Error de autenticación:', data.message);
      addLog(`Error de autenticación: ${data.message}`);
    });

    socket.on('job_started', (data) => {
      console.log('Trabajo iniciado:', data);
      setStatus('Procesamiento iniciado');
      setStage('processing');
      addLog(`Procesamiento iniciado para: ${data.albumTitle}`);
    });

    socket.on('job_update', (data: JobUpdate) => {
      console.log('Actualización de trabajo:', data);
      
      if (data.progress !== undefined) {
        setProgress(data.progress);
      }
      
      if (data.message) {
        setStatus(data.message);
        addLog(data.message);
      }

      // Determinar etapa basada en el progreso
      if (data.progress !== undefined) {
        if (data.progress < 25) {
          setStage('download');
        } else if (data.progress < 60) {
          setStage('transcode');
        } else if (data.progress < 85) {
          setStage('ipfs');
        } else {
          setStage('database');
        }
      }
    });

    socket.on('job_completed', (data: JobCompleted) => {
      console.log('Trabajo completado:', data);
      
      if (data.success) {
        setProgress(100);
        setStatus('¡Álbum subido exitosamente!');
        setIsCompleted(true);
        addLog('Procesamiento completado exitosamente');
        onComplete?.(true, data.albumId);
      } else {
        setIsError(true);
        setErrorMessage(data.error || 'Error desconocido');
        setStatus('Error en el procesamiento');
        addLog(`Error: ${data.error || 'Error desconocido'}`);
        onError?.(data.error || 'Error desconocido');
      }
    });

    socket.on('job_error', (data) => {
      console.error('Error en trabajo:', data);
      setIsError(true);
      setErrorMessage(data.error);
      setStatus('Error en el procesamiento');
      addLog(`Error: ${data.error}`);
      onError?.(data.error);
    });

    socket.on('disconnect', () => {
      console.log('Desconectado de WebSocket');
      addLog('Desconectado del servidor');
    });

    socket.on('connect_error', (error) => {
      console.error('Error de conexión WebSocket:', error);
      addLog('Error de conexión al servidor');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [jobId, userId, onComplete, onError]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getStageIcon = (currentStage: string) => {
    const iconProps = { size: 20 };
    
    switch (currentStage) {
      case 'upload':
        return <Upload {...iconProps} />;
      case 'download':
        return <Upload {...iconProps} />;
      case 'transcode':
        return <Music {...iconProps} />;
      case 'ipfs':
        return <Disc {...iconProps} />;
      case 'database':
        return <CheckCircle {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
  };

  const getStageLabel = (currentStage: string) => {
    switch (currentStage) {
      case 'upload':
        return 'Subiendo archivos';
      case 'download':
        return 'Preparando archivos';
      case 'transcode':
        return 'Transcodificando audio';
      case 'ipfs':
        return 'Subiendo a IPFS';
      case 'database':
        return 'Creando registros';
      default:
        return 'Procesando';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Subiendo Álbum
        </h2>
        <p className="text-gray-600">{albumTitle}</p>
      </div>

      {/* Estado principal */}
      <div className="flex items-center justify-center mb-6">
        {isCompleted ? (
          <CheckCircle className="text-green-500 mr-3" size={32} />
        ) : isError ? (
          <XCircle className="text-red-500 mr-3" size={32} />
        ) : (
          <Loader2 className="text-blue-500 mr-3 animate-spin" size={32} />
        )}
        <div>
          <p className="text-lg font-semibold text-gray-900">{status}</p>
          {!isCompleted && !isError && (
            <p className="text-sm text-gray-600">{getStageLabel(stage)}</p>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      {!isCompleted && !isError && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Etapas del proceso */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {['download', 'transcode', 'ipfs', 'database'].map((stageKey, index) => {
          const isActive = stage === stageKey;
          const isCompleted = progress > (index + 1) * 25;
          
          return (
            <div 
              key={stageKey}
              className={`flex flex-col items-center p-3 rounded-lg ${
                isActive ? 'bg-blue-50 border-2 border-blue-200' :
                isCompleted ? 'bg-green-50 border-2 border-green-200' :
                'bg-gray-50 border-2 border-gray-200'
              }`}
            >
              <div className={`mb-2 ${
                isActive ? 'text-blue-500' :
                isCompleted ? 'text-green-500' :
                'text-gray-400'
              }`}>
                {getStageIcon(stageKey)}
              </div>
              <span className={`text-xs font-medium ${
                isActive ? 'text-blue-700' :
                isCompleted ? 'text-green-700' :
                'text-gray-500'
              }`}>
                {getStageLabel(stageKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <XCircle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700 font-medium">Error en el procesamiento</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{errorMessage}</p>
        </div>
      )}

      {/* Success message */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="text-green-500 mr-2" size={20} />
            <p className="text-green-700 font-medium">¡Álbum subido exitosamente!</p>
          </div>
          <p className="text-green-600 text-sm mt-1">
            Tu álbum está ahora disponible en la plataforma
          </p>
        </div>
      )}

      {/* Logs expandibles */}
      <details className="bg-gray-50 rounded-lg p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
          Ver detalles del proceso ({logs.length} eventos)
        </summary>
        <div className="max-h-40 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="text-xs text-gray-600 font-mono py-1">
              {log}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
