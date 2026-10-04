// Testa a regra de moderação de fotos (resposta da Sightengine → aprovar/recusar).
// Uso: npm run test:moderation
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decide } from '../functions/_shared/moderation.ts';

// Resposta típica de foto comum (formato da documentação da Sightengine, nudity-2.1).
const clean = {
  status: 'success',
  nudity: {
    sexual_activity: 0.01,
    sexual_display: 0.01,
    erotica: 0.01,
    very_suggestive: 0.01,
    suggestive: 0.01,
    mildly_suggestive: 0.01,
    none: 0.99,
  },
  gore: { prob: 0.01 },
  offensive: { nazi: 0.01, asian_swastika: 0.01, supremacist: 0.01, confederate: 0.01, terrorist: 0.01, middle_finger: 0.01 },
};

const withNudity = (patch: Record<string, number>) => ({ ...clean, nudity: { ...clean.nudity, ...patch } });

test('foto comum é aprovada', () => {
  assert.deepEqual(decide(clean), { ok: true, reasons: [] });
});

test('biquíni / praia (sugestivo) é aprovado', () => {
  assert.equal(decide(withNudity({ suggestive: 0.95, very_suggestive: 0.7, none: 0.05 })).ok, true);
});

test('nudez explícita é recusada', () => {
  const d = decide(withNudity({ sexual_display: 0.92 }));
  assert.equal(d.ok, false);
  assert.ok(d.reasons.includes('nudez explícita'));
});

test('atividade sexual é recusada', () => {
  assert.equal(decide(withNudity({ sexual_activity: 0.8 })).ok, false);
});

test('conteúdo erótico acima do limite é recusado, abaixo passa', () => {
  assert.equal(decide(withNudity({ erotica: 0.7 })).ok, false);
  assert.equal(decide(withNudity({ erotica: 0.4 })).ok, true);
});

test('violência gráfica é recusada (por prob ou pelas classes)', () => {
  assert.equal(decide({ ...clean, gore: { prob: 0.9 } }).ok, false);
  assert.equal(decide({ ...clean, gore: { classes: { very_bloody: 0.8 } } }).ok, false);
});

test('símbolo de ódio é recusado; gesto obsceno não', () => {
  assert.equal(decide({ ...clean, offensive: { ...clean.offensive, nazi: 0.95 } }).ok, false);
  assert.equal(decide({ ...clean, offensive: { ...clean.offensive, middle_finger: 0.95 } }).ok, true);
});

test('vários problemas ao mesmo tempo aparecem todos nos motivos', () => {
  const d = decide({ ...withNudity({ sexual_display: 0.9 }), gore: { prob: 0.9 } });
  assert.deepEqual(d.reasons.sort(), ['nudez explícita', 'violência'].sort());
});

test('resposta sem algum modelo não quebra', () => {
  assert.equal(decide({ status: 'success' }).ok, true);
});
