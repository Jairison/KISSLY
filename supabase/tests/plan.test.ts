// Testa a regra que converte os direitos do RevenueCat no plano do Kissly.
// Uso: npm run test:plan
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePlan } from '../functions/_shared/plan.ts';

const now = new Date('2026-10-01T12:00:00Z');
const future = '2026-11-01T12:00:00Z';
const past = '2026-09-01T12:00:00Z';

test('sem direitos = grátis', () => {
  assert.deepEqual(resolvePlan({}, now), { plan: 'free', expiresAt: null });
  assert.deepEqual(resolvePlan({ entitlements: {} }, now), { plan: 'free', expiresAt: null });
});

test('direito ativo vira o plano, com a data de expiração', () => {
  assert.deepEqual(resolvePlan({ entitlements: { gold: { expires_date: future } } }, now), {
    plan: 'gold',
    expiresAt: future,
  });
});

test('direito vencido é ignorado', () => {
  assert.equal(resolvePlan({ entitlements: { gold: { expires_date: past } } }, now).plan, 'free');
});

test('com vários direitos ativos, vale o maior', () => {
  const subscriber = { entitlements: { plus: { expires_date: future }, platinum: { expires_date: future } } };
  assert.equal(resolvePlan(subscriber, now).plan, 'platinum');
});

test('maior vencido + menor ativo = o menor', () => {
  const subscriber = { entitlements: { platinum: { expires_date: past }, plus: { expires_date: future } } };
  assert.equal(resolvePlan(subscriber, now).plan, 'plus');
});

test('vitalício (sem data de expiração) é ativo', () => {
  assert.deepEqual(resolvePlan({ entitlements: { plus: { expires_date: null } } }, now), {
    plan: 'plus',
    expiresAt: null,
  });
});

test('direitos com outros nomes são ignorados', () => {
  assert.equal(resolvePlan({ entitlements: { premium: { expires_date: future } } }, now).plan, 'free');
});
