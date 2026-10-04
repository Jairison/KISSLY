// Regra pura (sem dependências) que decide se uma foto pode ficar no perfil, a partir da
// resposta da Sightengine (modelos nudity-2.1, gore-2.0 e offensive-2.0).
// Testada em supabase/tests/moderation.test.ts.
//
// Num app de namoro, fotos de praia, biquíni ou sem camisa são normais: só recusamos
// conteúdo sexual explícito/erótico, violência gráfica e símbolos de ódio.

export type SightengineResult = {
  status?: string;
  nudity?: Record<string, unknown>;
  gore?: Record<string, unknown>;
  offensive?: Record<string, unknown>;
};

export type ModerationDecision = { ok: boolean; reasons: string[] };

export const THRESHOLDS = {
  sexual_activity: 0.5,
  sexual_display: 0.5,
  erotica: 0.6,
  gore: 0.6,
  hate: 0.6,
} as const;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Maior pontuação entre as chaves pedidas (procura também dentro de "classes"). */
function maxOf(obj: Record<string, unknown> | undefined, keys: string[]): number {
  if (!obj) return 0;
  const classes = (obj.classes ?? {}) as Record<string, unknown>;
  return Math.max(0, ...keys.map((k) => Math.max(num(obj[k]), num(classes[k]))));
}

export function decide(result: SightengineResult): ModerationDecision {
  const reasons: string[] = [];
  const n = result.nudity;

  if (num(n?.sexual_activity) >= THRESHOLDS.sexual_activity) reasons.push('atividade sexual');
  if (num(n?.sexual_display) >= THRESHOLDS.sexual_display) reasons.push('nudez explícita');
  if (num(n?.erotica) >= THRESHOLDS.erotica) reasons.push('conteúdo erótico');

  // gore-2.0: usa "prob" se existir; senão, as classes mais graves.
  const gore = Math.max(
    num(result.gore?.prob),
    maxOf(result.gore, ['very_bloody', 'body_organ', 'serious_injury', 'corpse']),
  );
  if (gore >= THRESHOLDS.gore) reasons.push('violência');

  // offensive-2.0: símbolos de ódio (o gesto obsceno e a suástica asiática religiosa ficam de fora).
  if (maxOf(result.offensive, ['nazi', 'supremacist', 'terrorist', 'confederate']) >= THRESHOLDS.hate) {
    reasons.push('símbolo de ódio');
  }

  return { ok: reasons.length === 0, reasons };
}
