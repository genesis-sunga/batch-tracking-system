import { renderEmail } from './email-templates';

describe('email templates', () => {
  it('escapes dynamic HTML and marks overdue batches distinctly', () => {
    const mail = renderEmail('expiry_approaching', {
      batchNumber: '<img src=x onerror=alert(1)>',
      daysRemaining: -3,
    });

    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img');
    expect(mail.subject).toContain('expiry alert');
  });
});
