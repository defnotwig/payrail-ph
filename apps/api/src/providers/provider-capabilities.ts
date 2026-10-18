export interface ProviderCapabilities {
  provider: string;
  supportsAuthorization: boolean;
  supportsCapture: boolean;
  supportsVoid: boolean;
  supportsRefund: boolean;
  supportsPartialRefund: boolean;
  supports3DSecure: boolean;
  supportsChargebackEvents: boolean;
  supportsSettlementReporting: boolean;
}

export const PROVIDER_CAPABILITIES_MAP: Record<string, ProviderCapabilities> = {
  paymongo: {
    provider: "paymongo",
    supportsAuthorization: false, // Standard PayMongo direct charge model
    supportsCapture: false,
    supportsVoid: false,
    supportsRefund: true,
    supportsPartialRefund: true,
    supports3DSecure: true, // 3-D Secure required for Philippine card acquiring
    supportsChargebackEvents: false,
    supportsSettlementReporting: false,
  },
  xendit: {
    provider: "xendit",
    supportsAuthorization: true,
    supportsCapture: true,
    supportsVoid: true,
    supportsRefund: true,
    supportsPartialRefund: true,
    supports3DSecure: true,
    supportsChargebackEvents: true,
    supportsSettlementReporting: true,
  },
};
