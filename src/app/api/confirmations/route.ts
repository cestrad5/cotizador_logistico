import { NextResponse } from 'next/server';
import { appendConfirmation } from '@/lib/googleSheetsServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      idServicio,
      fechaRegistro,
      empresa,
      cliente,
      origen,
      destino,
      capacidad,
      total,
      direccion,
      direccionEntrega,
      fechaRecogida,
      horaRecogida
    } = body;

    const row = [
      idServicio,
      fechaRegistro,
      empresa,
      cliente,
      origen,
      destino,
      capacidad,
      total,
      direccion,
      direccionEntrega,
      fechaRecogida,
      horaRecogida
    ];

    await appendConfirmation(row);

    return NextResponse.json({ success: true, message: 'Servicio confirmado correctamente' });
  } catch (error: any) {
    console.error('Confirmation API Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al confirmar el servicio' },
      { status: 500 }
    );
  }
}
