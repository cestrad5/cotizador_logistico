import { NextResponse } from 'next/server';
import { appendQuotation } from '@/lib/googleSheetsServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      idCotizacion,
      fecha, 
      cliente, 
      empresa, 
      origen, 
      destino, 
      capacidad, 
      valorDeclarado, 
      total 
    } = body;

    // Prepare row data for Google Sheets
    const row = [
      idCotizacion,
      fecha,
      cliente,
      empresa,
      origen,
      destino,
      capacidad,
      valorDeclarado,
      total
    ];

    await appendQuotation(row);

    return NextResponse.json({ success: true, message: 'Cotización registrada correctamente' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al registrar la cotización';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
