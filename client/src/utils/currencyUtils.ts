/**
 * Format a number into Indian currency format (e.g. ₹1,27,500.00)
 */
export const formatINR = (amount: number): string => {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + lastThree;
  return `₹${formatted}.${decPart}`;
};

/**
 * Format a number into short Indian currency (e.g. 1.27L, 12.5K)
 */
export const formatINRShort = (amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
};

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitWords = (n: number): string => {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
};

/**
 * Convert number to Indian currency words (e.g. "Rupees One Lakh Twenty Seven Thousand Five Hundred Only")
 */
export const numberToWords = (amount: number): string => {
  if (amount === 0) return 'Rupees Zero Only';

  const num = Math.floor(Math.abs(amount));
  const parts: string[] = [];

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  if (crore > 0) parts.push(twoDigitWords(crore) + ' Crore');
  if (lakh > 0) parts.push(twoDigitWords(lakh) + ' Lakh');
  if (thousand > 0) parts.push(twoDigitWords(thousand) + ' Thousand');
  if (hundred > 0) parts.push(ones[hundred] + ' Hundred');
  if (remainder > 0) parts.push(twoDigitWords(remainder));

  return 'Rupees ' + parts.join(' ') + ' Only';
};
