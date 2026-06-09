/**
 * Swappable payment provider layer.
 * Today: mock + mock-ENET. Tomorrow: KNET, MyFatoorah, Stripe, real ENET — same shape.
 */

export type ProviderResult = {
  success: boolean;
  providerRef: string;
  failureReason?: string;
  raw?: Record<string, unknown>;
};

export type ChargeInput = {
  userId: string;
  amountKwd: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentProvider {
  name: "mock" | "enet";
  charge(input: ChargeInput): Promise<ProviderResult>;
}

function randRef(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async charge(input) {
    // Deterministic test hooks: ".001" suffix amounts simulate a decline.
    const declineSuffix = input.amountKwd.endsWith(".001");
    if (declineSuffix) {
      return {
        success: false,
        providerRef: randRef("mock_decl"),
        failureReason: "CARD_DECLINED"
      };
    }
    return { success: true, providerRef: randRef("mock_ok") };
  }
};

/**
 * Mock ENET adapter. Approval rule is configurable via env / runtime knob.
 * Defaults to approve. Set BELAMONDA_MOCK_ENET=reject to reject all.
 * Per-customer override via BELAMONDA_MOCK_ENET_REJECT_USERS=cust1,cust2
 */
export const enetProvider: PaymentProvider = {
  name: "enet",
  async charge(input) {
    const mode = (process.env.BELAMONDA_MOCK_ENET ?? "approve").toLowerCase();
    const rejectUsers = (process.env.BELAMONDA_MOCK_ENET_REJECT_USERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (mode === "reject" || rejectUsers.includes(input.userId)) {
      return {
        success: false,
        providerRef: randRef("enet_decl"),
        failureReason: "ENET_REJECTED"
      };
    }
    return { success: true, providerRef: randRef("enet_ok") };
  }
};

export function getProviderForMethod(method: "card_mock" | "enet" | string): PaymentProvider {
  if (method === "enet") return enetProvider;
  return mockProvider;
}
