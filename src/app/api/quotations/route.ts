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
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al registrar la cotización' },
      { status: 500 }
    );
  }
}
