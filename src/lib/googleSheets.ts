import Papa from 'papaparse';

const SPREADSHEET_ID = '1JjUXAY70ZAcRODGp1pNTcUPUG693BtUntBBZP4E0ZVY';

export const GIDS = {
  CLIENTES: '1624519610',
  RUTAS: '1435815011',
  OPCIONES: '0',
};

export interface Cliente {
  IDcliente: string;
  Empresa: string;
  Nombre_contacto: string;
  '%Descuento': string;
  Username: string;
  Password: string;
}

export interface Ruta {
  Origen: string;
  Destino: string;
  [capacity: string]: string;
}

export async function fetchSheetData<T>(gid: string): Promise<T[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }
    
    const csvData = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data as T[]);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

export function parsePercentage(percentageStr: string): number {
  if (!percentageStr) return 0;
  return parseFloat(percentageStr.replace('%', '')) / 100;
}

export function parseCurrency(currencyStr: string): number {
  if (!currencyStr) return 0;
  // Handles formats like "$ 1,294,118"
  return parseFloat(currencyStr.replace(/[$,\s]/g, ''));
}
