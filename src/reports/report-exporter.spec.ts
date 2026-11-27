import { Response } from 'express';
import { exportReport } from './report-exporter';
import { ReportFormat } from './report-query.dto';

describe('report exports', () => {
  it('escapes CSV cells and neutralizes spreadsheet formulas', () => {
    const response = {
      setHeader: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;

    exportReport(
      response,
      'stock-report',
      'Stock report',
      [{ batchNumber: '=1+1', productName: 'A "quoted" item' }],
      ReportFormat.CSV,
    );

    expect(response.send).toHaveBeenCalledWith(
      '"batchNumber","productName"\r\n"\'=1+1","A ""quoted"" item"',
    );
  });
});
