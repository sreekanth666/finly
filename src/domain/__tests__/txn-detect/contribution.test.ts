import {
  bindingOf,
  contributionBody,
  contributionSubject,
  decodeSegments,
  deriveSegments,
  DEVELOPER_EMAIL,
  mailtoUrl,
  maskMessage,
  normaliseText,
  suggestTags,
  detect,
  MAILTO_LIMIT,
  type TemplateSpec,
} from '@/domain/txn-detect';

const SAMPLE = {
  body: 'Dear Sreekanth, your SuperCard 0194 debited for INR 700.00 on 02 Sep 07:12 PM for UPI - 661184090154. To dispute call 18003097986 - Utkarsh SFBL',
  sender: 'JM-UTKSFB-S',
  receivedAt: new Date(2026, 8, 2, 19, 13).getTime(),
};

function template(): TemplateSpec {
  const text = normaliseText(SAMPLE.body);
  return {
    id: 't1',
    name: 'Utkarsh SFB · money out',
    binding: bindingOf(SAMPLE),
    outcome: 'transaction',
    direction: 'debit',
    overridesGate: null,
    segments: deriveSegments(text, suggestTags(text, detect(SAMPLE))),
    updatedAt: 1,
  };
}

describe('the contribution email', () => {
  it('carries the masked message and a template the developer can decode', () => {
    const masked = maskMessage(SAMPLE.body);
    const body = contributionBody({ maskedMessage: masked, template: template(), appVersion: '1.0.1', parserVersion: 1 });

    expect(body).toContain('Dear NAME');
    expect(body).not.toContain('Sreekanth');
    expect(body).not.toContain('661184090154');
    expect(body).toContain('Sender: UTKSFB · Utkarsh SFB');
    expect(body).toContain('What it is: money out, payment');
    expect(body).toContain('App 1.0.1 · reader 1');

    const payload = JSON.parse(body.slice(body.indexOf('{')));
    expect(payload.outcome).toBe('transaction');
    expect(decodeSegments(payload.segments)).toEqual(template().segments);
  });

  it('fits a real template and message in one mailto link, addressed to the developer', () => {
    const body = contributionBody({
      maskedMessage: maskMessage(SAMPLE.body),
      template: template(),
      appVersion: '1.0.1',
      parserVersion: 1,
    });
    const url = mailtoUrl(contributionSubject(template(), 'UTKSFB'), body);
    expect(url).not.toBeNull();
    expect(url!.startsWith(`mailto:${DEVELOPER_EMAIL}?subject=`)).toBe(true);
    expect(url!.length).toBeLessThanOrEqual(MAILTO_LIMIT);
    expect(decodeURIComponent(url!.slice(url!.indexOf('&body=') + 6))).toContain('\r\n');
  });

  it('refuses a link too long to trust a mail app with, so the caller shares instead', () => {
    expect(mailtoUrl('x', 'y'.repeat(MAILTO_LIMIT))).toBeNull();
  });

  it('says a plain misread is a misread, without a template', () => {
    const body = contributionBody({ maskedMessage: 'x', template: null, appVersion: null, parserVersion: 1 });
    expect(body).toContain('did not read this message correctly');
    expect(body).not.toContain('Template:');
    expect(contributionSubject(null, 'HDFCBK')).toBe('Finly misread a message from HDFCBK');
  });
});
