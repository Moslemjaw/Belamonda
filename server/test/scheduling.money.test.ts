import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { api, cashbackBalance, makeUser, makeUserOffer, makeWallet, walletUnlocked } from "./helpers.js";

const clinicId = String(new mongoose.Types.ObjectId());

async function bookingWithDeductedCashback(userId: string, userOfferId: string, status = "request_received") {
  const breq = await BookingRequestModel.create({
    userId,
    userOfferId,
    clinicId,
    status,
    cashbackDeductedKwd: "2.000"
  });
  return String(breq._id);
}

describe("customer cancel", () => {
  it("refunds deducted cashback to the membership balance and wallet", async () => {
    const customer = await makeUser("customer");
    await makeWallet(customer.id, "1.000");
    const uoId = await makeUserOffer(customer.id, { cashbackBalanceKwd: "5.000" });
    const breqId = await bookingWithDeductedCashback(customer.id, uoId);

    const res = await api()
      .post(`/scheduling/me/requests/${breqId}/cancel`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("cancelled");
    expect(await cashbackBalance(uoId)).toBe("7.000");
    expect(await walletUnlocked(customer.id)).toBe("3.000");
  });

  it("refunds only once when cancel is sent twice at the same time", async () => {
    const customer = await makeUser("customer");
    await makeWallet(customer.id, "1.000");
    const uoId = await makeUserOffer(customer.id, { cashbackBalanceKwd: "5.000" });
    const breqId = await bookingWithDeductedCashback(customer.id, uoId);

    const send = () =>
      api().post(`/scheduling/me/requests/${breqId}/cancel`).set("Authorization", `Bearer ${customer.token}`).send({});
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect(await cashbackBalance(uoId)).toBe("7.000");
    expect(await walletUnlocked(customer.id)).toBe("3.000");
  });
});

describe("staff reject", () => {
  it("refunds deducted cashback", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    await makeWallet(customer.id, "0.000");
    const uoId = await makeUserOffer(customer.id, { cashbackBalanceKwd: "1.000" });
    const breqId = await bookingWithDeductedCashback(customer.id, uoId, "slot_assigned");

    const res = await api()
      .post(`/scheduling/requests/${breqId}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "Clinic closed" });

    expect(res.status).toBe(200);
    expect(await cashbackBalance(uoId)).toBe("3.000");
    expect(await walletUnlocked(customer.id)).toBe("2.000");
  });
});

describe("clinic POS mark-paid", () => {
  it("rolls back the payment when the cashback deduction is refused", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    await makeWallet(customer.id, "1.000");
    const uoId = await makeUserOffer(customer.id, { cashbackBalanceKwd: "1.000" });
    const pay = await PaymentModel.create({
      userId: customer.id,
      amountKwd: "20.000",
      method: "card_mock",
      purpose: "session_payment",
      status: "payment_pending"
    });
    const breq = await BookingRequestModel.create({
      userId: customer.id,
      userOfferId: uoId,
      clinicId,
      status: "scheduled",
      sessionPriceKwd: "20.000",
      sessionPaymentId: String(pay._id)
    });

    const res = await api()
      .post(`/scheduling/requests/${breq._id}/mark-paid`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ cashbackToDeductKwd: "10.000" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INSUFFICIENT_UNLOCKED");
    // Before: the payment was already flipped to "paid" (and revenue counted) before the 400.
    expect((await PaymentModel.findById(pay._id).lean<{ status: string }>())?.status).toBe("payment_pending");
    expect((await BookingRequestModel.findById(breq._id).lean<{ clinicPaymentStatus?: string }>())?.clinicPaymentStatus).not.toBe("paid");
    expect(await walletUnlocked(customer.id)).toBe("1.000");
  });

  it("marks paid and deducts cashback when the wallet covers it", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    await makeWallet(customer.id, "5.000");
    const uoId = await makeUserOffer(customer.id, { cashbackBalanceKwd: "5.000" });
    const breq = await BookingRequestModel.create({
      userId: customer.id,
      userOfferId: uoId,
      clinicId,
      status: "scheduled",
      sessionPriceKwd: "20.000"
    });

    const res = await api()
      .post(`/scheduling/requests/${breq._id}/mark-paid`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ cashbackToDeductKwd: "3.000" });

    expect(res.status).toBe(200);
    expect(res.body.request.clinicPaymentStatus).toBe("paid");
    expect(res.body.request.finalPaidKwd).toBe("17.000");
    expect(await walletUnlocked(customer.id)).toBe("2.000");
    expect(await cashbackBalance(uoId)).toBe("2.000");
    expect(await PaymentModel.countDocuments({ bookingRequestId: String(breq._id), status: "paid" })).toBe(1);
  });
});
