import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ipfs-hifi-music-streaming.onrender.com';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    
    // Llamar al backend para obtener el álbum
    const backendResponse = await fetch(`${BACKEND_URL}/api/catalog/albums/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      if (backendResponse.status === 404) {
        return NextResponse.json(
          { error: 'Álbum no encontrado' },
          { status: 404 }
        );
      }
      throw new Error(`Backend error: ${backendResponse.status}`);
    }

    const response = await backendResponse.json();
    console.log('🔌 Backend response:', response);
    
    // El backend devuelve { ok: true, album: {...} }
    // Extraer solo el album para el frontend
    if (response.ok && response.album) {
      console.log('✅ Extracting album data:', response.album);
      return NextResponse.json(response.album);
    } else {
      console.error('❌ Invalid backend response structure:', response);
      throw new Error('Invalid response structure from backend');
    }
    
  } catch (error) {
    console.error('Error fetching album from backend:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
