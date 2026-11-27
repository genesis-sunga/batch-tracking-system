import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import type PDFDocumentType from 'pdfkit';
import { ReportFormat } from './report-query.dto';

function csvCell(value: unknown): string {
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n');
}

export function exportReport(
  response: Response,
  filename: string,
  title: string,
  rows: Record<string, unknown>[],
  format: ReportFormat,
): void {
  const extension = format;
  response.setHeader('content-disposition', `attachment; filename="${filename}.${extension}"`);

  if (format === ReportFormat.JSON) {
    response.type('application/json').send(rows);
    return;
  }
  if (format === ReportFormat.CSV) {
    response.type('text/csv; charset=utf-8').send(toCsv(rows));
    return;
  }
  if (format !== ReportFormat.PDF) throw new BadRequestException('Unsupported report format');

  response.type('application/pdf');
  const PDFDocument = require('pdfkit') as typeof PDFDocumentType;
  const document = new PDFDocument({ size: 'A4', margin: 40 });
  document.pipe(response);
  document.fontSize(18).text(title, { underline: true });
  document.moveDown();
  document.fontSize(9);
  if (rows.length === 0) {
    document.text('No records found.');
  } else {
    rows.forEach((row, index) => {
      document.text(`${index + 1}. ${JSON.stringify(row)}`);
      document.moveDown(0.5);
    });
  }
  document.end();
}
