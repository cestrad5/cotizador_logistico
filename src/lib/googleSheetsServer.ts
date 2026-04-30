import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!email || !key) {
    throw new Error('Missing Google Service Account credentials in environment variables');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: SCOPES,
  });

  return auth;
}

export async function appendQuotation(data: any[]) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // First, ensure headers exist (optional but good for empty sheets)
    try {
      const checkRange = 'COTIZACIONES!A1:I1';
      const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: checkRange });
      if (!check.data.values || check.data.values.length === 0) {
        const headers = ['ID Cotización', 'Fecha', 'Cliente', 'Empresa', 'Origen', 'Destino', 'Capacidad', 'Valor Declarado', 'Total'];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: checkRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] }
        });
      }
    } catch (e) {
      console.warn('Could not initialize headers, maybe sheet is not empty or permission issue:', e);
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'COTIZACIONES!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error appending to Google Sheets:', error);
    throw error;
  }
}
export async function appendConfirmation(data: any[]) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Ensure headers exist for CONFIRMACIONES
    try {
      const checkRange = 'CONFIRMACIONES!A1:L1';
      const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: checkRange });
      if (!check.data.values || check.data.values.length === 0) {
        const headers = [
          'ID Servicio', 'Fecha Registro', 'Empresa', 'Cliente', 
          'Origen', 'Destino', 'Capacidad', 'Total', 
          'Direccion Recogida', 'Direccion Entrega', 'Fecha Recogida', 'Hora Recogida'
        ];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: checkRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] }
        });
      }
    } catch (e) {
      console.warn('Could not initialize headers for CONFIRMACIONES:', e);
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'CONFIRMACIONES!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error appending confirmation to Google Sheets:', error);
    throw error;
  }
}
