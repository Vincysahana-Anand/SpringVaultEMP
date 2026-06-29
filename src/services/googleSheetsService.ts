import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import { config } from '../shared/config';

const GOOGLE_SHEET_URL = config.googleSheets.deliveryUrl;
const GOOGLE_SHEET_REPORT_URL = config.googleSheets.reportUrl;

/**
 * CREATE delivery record for a customerId (POST)
 */
export async function createDeliveryInGoogleSheet(customerId: string, delivery: any): Promise<any | ServiceError> {
  try {
    return await callGoogleSheet(GOOGLE_SHEET_URL, 'POST', { customerId, delivery });
  } catch (error) {
    return handleServiceError(error, 'createDeliveryInGoogleSheet');
  }
}

/**
 * READ all delivery records for a customerId (GET)
 */
export async function getDeliveriesFromGoogleSheet(customerId: string): Promise<any | ServiceError> {
  try {
    const url = `${GOOGLE_SHEET_URL}?customerId=${encodeURIComponent(customerId)}`;
    return await callGoogleSheet(url, 'GET');
  } catch (error) {
    return handleServiceError(error, 'getDeliveriesFromGoogleSheet');
  }
}

/**
 * UPDATE a delivery record by ID for a customerId (PUT)
 */
export async function updateDeliveryInGoogleSheet(
  customerId: string,
  id: number | string,
  updates: Record<string, any>
): Promise<any | ServiceError> {
  try {
    return await callGoogleSheet(GOOGLE_SHEET_URL, 'PUT', { customerId, id, updates });
  } catch (error) {
    return handleServiceError(error, 'updateDeliveryInGoogleSheet');
  }
}

/**
 * DELETE a delivery record by ID for a customerId (DELETE)
 */
export async function deleteDeliveryFromGoogleSheet(customerId: string, id: number | string): Promise<any | ServiceError> {
  try {
    return await callGoogleSheet(GOOGLE_SHEET_URL, 'DELETE', { customerId, id });
  } catch (error) {
    return handleServiceError(error, 'deleteDeliveryFromGoogleSheet');
  }
}

/**
 * POST: Create daily report in Google Sheets
 */
export async function createDailyReportInGoogleSheet(dailyReport: any): Promise<any | ServiceError> {
  try {
    return await callGoogleSheet(
      `${GOOGLE_SHEET_REPORT_URL}?type=dailyReport`,
      'POST',
      { dailyReport }
    );
  } catch (error) {
    return handleServiceError(error, 'createDailyReportInGoogleSheet');
  }
}

/**
 * GET: Fetch daily reports for today, optional filter by paymentMethod
 */
export async function getDailyReportsFromGoogleSheet(paymentMethod?: string, formattedDate?: any): Promise<any | ServiceError> {
  try {
    const url = `${GOOGLE_SHEET_REPORT_URL}?type=dailyReport` +
                (paymentMethod ? `&paymentMethod=${encodeURIComponent(paymentMethod)}` : '')+
                (formattedDate ? `&date=${encodeURIComponent(formattedDate)}` : '');
    // console.log('Fetching daily reports from:', url);
    return await callGoogleSheet(url, 'GET');
  } catch (error) {
    return handleServiceError(error, 'getDailyReportsFromGoogleSheet');
  }
}

/**
 * Generic helper
 */
async function callGoogleSheet(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: any
): Promise<any> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();
    // console.log(`Google Sheet ${method} Response:`, data);
    return data;
  } catch (error) {
    throw error;
  }
}
