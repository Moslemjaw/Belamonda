import { offersStore } from "../offers/offers.store.js";
import { clinicsStore } from "../clinics/clinics.store.js";
import { commerceStore } from "../commerce/commerce.store.js";
import { kycStore } from "../kyc/kyc.store.js";

function parseKwd(s: string) {
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

function fmtKwd(mils: number) {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}

export function computeFinanceSnapshot() {
  // Revenue = sum of confirmed subscription payments (we store on userOffer as paymentAmountKwd).
  // Pending = sum of pending subscription prices (we infer from offer.subscriptionPriceKwd).
  const pending = commerceStore.listPendingPayments();
  let pendingMils = 0;
  for (const uo of pending) {
    const offer = offersStore.get(uo.offerId);
    if (offer) pendingMils += parseKwd(offer.subscriptionPriceKwd);
  }

  const allUserOffers = new Set<string>(); // no direct list-all; approximate via pending + users’ lists
  // In local MVP, we don’t have a global user list; compute from pending queue and skip the rest.
  // This is enough for demo; later replace with Mongo queries.

  // Cashback liability (system-wide): sum wallets locked/unlocked/utilized from txns.
  // utilized = sum deductions
  const demoUsers = ["cust1"]; // local demo default; later replace with DB query
  let locked = 0;
  let unlocked = 0;
  let utilized = 0;
  for (const uid of demoUsers) {
    const w = kycStore.getWallet(uid);
    if (!w) continue;
    locked += parseKwd(w.lockedKwd);
    unlocked += parseKwd(w.unlockedKwd);
    const txns = kycStore.listWalletTxns(uid);
    for (const t of txns) if (t.type === "deduction") utilized += parseKwd(t.amountKwd);
  }

  const liability = locked + unlocked - utilized;

  return {
    revenueKwd: "0.000",
    pendingKwd: fmtKwd(pendingMils),
    cashback: {
      lockedKwd: fmtKwd(locked),
      unlockedKwd: fmtKwd(unlocked),
      utilizedKwd: fmtKwd(utilized),
      netLiabilityKwd: fmtKwd(liability)
    },
    counts: {
      pendingPayments: pending.length,
      activeClinics: clinicsStore.list({ activeOnly: true }).length,
      activeOffers: offersStore.listPublic({}).length
    }
  };
}

