export type EmailTemplate =
  | 'quality_failed'
  | 'batch_on_hold'
  | 'purchase_order_received'
  | 'batch_released'
  | 'batch_recalled'
  | 'expiry_approaching'
  | 'quarantine_reminder';

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const templates: Record<EmailTemplate, { subject: string; heading: string; message: string }> = {
  quality_failed: {
    subject: 'Quality test alert',
    heading: 'Quality test requires attention',
    message: 'A quality test failed or rejected its batch.',
  },
  batch_on_hold: {
    subject: 'Batch placed on hold',
    heading: 'Batch placed on hold',
    message: 'A batch was placed on hold and may need operational review.',
  },
  purchase_order_received: {
    subject: 'Purchase order receipt recorded',
    heading: 'Purchase order receipt recorded',
    message: 'A purchase-order delivery has been received into inventory.',
  },
  batch_released: {
    subject: 'Batch released',
    heading: 'Batch released',
    message: 'A batch passed its required quality checks and is released.',
  },
  batch_recalled: {
    subject: 'Critical batch recall',
    heading: 'Critical batch recall',
    message: 'A batch was rejected and requires immediate review.',
  },
  expiry_approaching: {
    subject: 'Batch expiry approaching',
    heading: 'Batch expiry approaching',
    message: 'A tracked batch is approaching its expiry date.',
  },
  quarantine_reminder: {
    subject: 'Quarantined batch reminder',
    heading: 'Batch remains in quarantine',
    message: 'A batch has remained in quarantine and needs follow-up.',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmail(template: EmailTemplate, data: Record<string, unknown>): RenderedEmail {
  const definition = templates[template];
  const details = Object.entries(data).map(([key, value]) => [key, String(value ?? '')]);
  const summary = details.map(([key, value]) => `${key}: ${value}`).join('\n');
  const htmlDetails = details
    .map(
      ([key, value]) =>
        `<tr><th align="left">${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const firstValue = data.batchNumber ?? data.reference ?? '';
  const daysRemaining = data.daysRemaining;
  const subject =
    template === 'expiry_approaching' && typeof daysRemaining === 'number' && daysRemaining < 0
      ? 'Batch expiry alert'
      : definition.subject;

  return {
    subject: `${subject}${firstValue ? `: ${String(firstValue)}` : ''}`,
    text: `${definition.heading}\n\n${definition.message}\n\n${summary}`,
    html: `<html><body><h1>${escapeHtml(definition.heading)}</h1><p>${escapeHtml(
      definition.message,
    )}</p><table>${htmlDetails}</table></body></html>`,
  };
}
