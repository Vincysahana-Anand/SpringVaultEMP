/**
 * Central configuration file for SpringVaultEMP.
 * Stores URLs, constants, and database keys.
 */

export const config = {
  // Google Sheets integration URLs
  googleSheets: {
    deliveryUrl: 'https://script.google.com/macros/s/AKfycbwUgiIihmkg5Y1kEqAaINS4jiarUqxVcBv6mc91Bu02rP2FZzY3kmBwiBKtvzRjk0ff/exec',
    reportUrl: 'https://script.google.com/macros/s/AKfycbwGMH2y-M4UuUUH1-D8JZHboIGQf1bsBbxOOKIDxXZ5FNV_2S1FKSoeh35xNOgc3dSe/exec',
  },

  // Firestore specific document IDs
  firestore: {
    counterSalesCustomerId: 'MyTjc2Kqa6DOMRLhnFSH',
    counterSalesCustomerName: 'CounterSales',
    /** Product doc IDs under dailyRecord — used for targeted date queries */
    dailyRecordProductIds: [
      '20L_CAN',
      '20L_PARTY_CAN',
      '1L_CASE',
      '500ML_CASE',
      '300ML_CASE',
      'Payments',
      'emptyReturned',
    ],
  },
};
