import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function test() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !spreadsheetId) {
    console.error('Missing environment variables');
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: SCOPES,
  });
  
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title);
    
    if (!sheetNames?.includes('COTIZACIONES')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'COTIZACIONES' } } }]
        }
      });
      console.log('Sheet "COTIZACIONES" created.');
    }

    const range = 'COTIZACIONES!A1:I1';
    const headers = ['ID Cotización', 'Fecha', 'Cliente', 'Empresa', 'Origen', 'Destino', 'Capacidad', 'Valor Declarado', 'Total'];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    });
    console.log('Headers initialized.');

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
