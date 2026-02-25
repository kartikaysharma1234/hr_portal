import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export const toCsv = (rows: Array<Record<string, unknown>>): string => {
  if (!rows.length) {
    return '';
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escapeCell = (value: unknown): string => {
    const raw = value === undefined || value === null ? '' : String(value);
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }

    return raw;
  };

  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }

  return lines.join('\n');
};

export const buildExcelBuffer = (
  rows: Array<Record<string, unknown>>,
  sheetName = 'Sheet1'
): Buffer => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
};

export const buildPdfBuffer = async (
  title: string,
  rows: Array<Record<string, unknown>>
): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title);
    doc.moveDown();

    if (!rows.length) {
      doc.fontSize(11).text('No data available');
      doc.end();
      return;
    }

    const headers = Object.keys(rows[0]);
    doc.fontSize(10).text(headers.join(' | '));
    doc.moveDown(0.5);

    for (const row of rows) {
      const line = headers.map((key) => String(row[key] ?? '')).join(' | ');
      doc.text(line);
    }

    doc.end();
  });
};

export const exportRows = async (
  format: ExportFormat,
  title: string,
  rows: Array<Record<string, unknown>>
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> => {
  if (format === 'excel') {
    return {
      buffer: buildExcelBuffer(rows, title.slice(0, 25) || 'Report'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx'
    };
  }

  if (format === 'pdf') {
    return {
      buffer: await buildPdfBuffer(title, rows),
      mimeType: 'application/pdf',
      extension: 'pdf'
    };
  }

  return {
    buffer: Buffer.from(toCsv(rows), 'utf-8'),
    mimeType: 'text/csv',
    extension: 'csv'
  };
};
