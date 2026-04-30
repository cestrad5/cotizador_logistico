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
  } catch (error: unknown) {
    console.error('Confirmation API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al confirmar el servicio';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
