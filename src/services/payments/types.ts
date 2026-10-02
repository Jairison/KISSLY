import type { Duration, PaidPlan } from '@/data/plans';
import type { Plan } from '@/types/user';

/** Uma opção de compra (plano + duração) com o preço já formatado pela loja. */
export type PlanOffer = {
  plan: PaidPlan;
  duration: Duration;
  /** Preço total, ex.: "R$ 179,90" */
  price: string;
  /** Equivalente mensal, ex.: "R$ 14,99/mês" */
  perMonth: string;
  /** Desconto em relação a pagar mês a mês (0–100). */
  savings: number;
  /** Referência interna para concluir a compra. */
  ref: unknown;
};

export type PurchaseResult = { status: 'purchased'; plan: Plan } | { status: 'cancelled' };

export class PaymentError extends Error {}

export interface Payments {
  readonly mode: 'revenuecat' | 'demo' | 'unavailable';
  /** Associa as compras à conta do Kissly (id do usuário). */
  identify(userId: string): Promise<void>;
  reset(): Promise<void>;
  getOffers(): Promise<PlanOffer[]>;
  purchase(offer: PlanOffer): Promise<PurchaseResult>;
  /** Recupera assinaturas feitas antes (troca de aparelho, reinstalação). */
  restore(): Promise<Plan>;
  /** Abre a tela da loja para cancelar ou trocar o plano. */
  manage(): Promise<void>;
}
