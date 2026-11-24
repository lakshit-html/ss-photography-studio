import test from 'node:test';
import assert from 'node:assert';
import { QRCodeService } from '../src/lib/qr.ts';

test('QR Code Service: generateDataUrl produces valid base64 PNG', async () => {
  const dataUrl = await QRCodeService.generateDataUrl('https://ssphotography.com/event/test-wedding');
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});

test('QR Code Service: generateSvg produces valid SVG markup', async () => {
  const svg = await QRCodeService.generateSvg('https://ssphotography.com/event/test-wedding');
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
});

test('QR Code Service: generatePrintablePosterSvg includes event details', async () => {
  const poster = await QRCodeService.generatePrintablePosterSvg(
    'Royal Udaipur Nuptials',
    'December 18, 2026',
    'Oberoi Udaivilas',
    'https://ssphotography.com/event/royal-udaipur'
  );
  assert.ok(poster.includes('SS PHOTOGRAPHY'));
  assert.ok(poster.includes('ROYAL UDAIPUR NUPTIALS'));
  assert.ok(poster.includes('December 18, 2026'));
  assert.ok(poster.includes('OBEROI UDAIVILAS'));
});
