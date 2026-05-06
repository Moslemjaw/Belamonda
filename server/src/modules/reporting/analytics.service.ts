import * as clinicService from "../../services/clinic.service.js";
import * as offerService from "../../services/offer.service.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { sumCompletedPaymentsKwd } from "../../services/payment.service.js";
import { PaymentModel } from "../../models/payment.model.js";
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

export async function computeFinanceSnapshot() {
  const revenueKwd = await sumCompletedPaymentsKwd();

  const pending = await userOfferService.listPendingPaymentsQueue();
  let pendingMils = 0;
  for (const uo of pending) {
    const offer = await offerService.getOffer(uo.offerId);
    if (offer) pendingMils += parseKwd(offer.subscriptionPriceKwd);
  }

  const paymentUserIds = await PaymentModel.distinct<string>("userId");
  const walletUserIds = new Set<string>([...paymentUserIds, ...pending.map((p) => p.userId), "cust1"]);

  let locked = 0;
  let unlocked = 0;
  let utilized = 0;
  for (const uid of walletUserIds) {
    const w = kycStore.getWallet(uid);
    if (!w) continue;
    locked += parseKwd(w.lockedKwd);
    unlocked += parseKwd(w.unlockedKwd);
    const txns = kycStore.listWalletTxns(uid);
    for (const t of txns) if (t.type === "deduction") utilized += parseKwd(t.amountKwd);
  }

  const liability = locked + unlocked - utilized;

  const clinics = await clinicService.listClinics({ activeOnly: true });
  const offersRes = await offerService.listOffersPublic({});

  return {
    revenueKwd,
    pendingKwd: fmtKwd(pendingMils),
    cashback: {
      lockedKwd: fmtKwd(locked),
      unlockedKwd: fmtKwd(unlocked),
      utilizedKwd: fmtKwd(utilized),
      netLiabilityKwd: fmtKwd(liability)
    },
    counts: {
      pendingPayments: pending.length,
      activeClinics: clinics.length,
      activeOffers: offersRes.items.length
    },
    totalRevenue: revenueKwd,
    totalCashbackLocked: fmtKwd(locked),
    totalCashbackUnlocked: fmtKwd(unlocked),
    totalCashbackUtilized: fmtKwd(utilized),
    pendingPaymentsCount: pending.length,
    pendingPaymentsKwd: fmtKwd(pendingMils),
    sessionsToday: 0,
    sessionsThisMonth: 0
  };
}
