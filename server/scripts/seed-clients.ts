import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { ClinicModel } from "../src/models/clinic.model.js";
import { WalletModel } from "../src/models/kyc.model.js";
import { randomBytes } from "crypto";

// Client data format: [name, phone, username, password, nationalId, svcCode, clinicCode, sessions, payCode, total, paid, pkgDate, expiry, remain, due]
// svcCode: "1"=single, "99"=pkg99, "89"=pkg89, "49"=pkg49, "59"=pkg59, "M"=mini, "S"=sbaya, "O"=other, "X"=cancelled, "C"=cashback
// clinicCode: "m8","m5","m2","sv","as","h3","hc","im","nv","id",""
// payCode: "F"=full, "I"=installments, "D"=deposit

type ClientRow = [string,string,string,string,string,string,string,number,string,number,number,string,string,number,string];

const CLINIC_MAP: Record<string, string> = {
  m8: "مارينا 8",
  m5: "مارينا5",
  m2: "مارينا 2",
  sv: "المهبولة - سفن كلينك",
  as: "مستوصف اسيل - بنيد القار - يارو 11",
  h3: "هوب كلينك دور 3 - اماني",
  hc: "هوب كلينك - كارول",
  im: "آي ميد - صباح السالم",
  nv: "نوفا ميد دور 11 - السالمية",
  id: "عيادة ID - صباح السالم",
};

async function loadData(): Promise<ClientRow[]> {
  const batches: ClientRow[][] = [];
  for (let i = 1; i <= 10; i++) {
    try {
      const mod = await import(`./clients-batch-${i}.js`);
      if (mod.default) batches.push(mod.default);
      else if (mod.data) batches.push(mod.data);
    } catch { break; }
  }
  return batches.flat();
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const clients = await loadData();
  console.log(`Loaded ${clients.length} clients`);

  // Build clinic name -> id map
  const clinics = await ClinicModel.find({}).lean() as any[];
  const clinicIdMap: Record<string, string> = {};
  for (const c of clinics) {
    clinicIdMap[c.nameAr?.trim()] = String(c._id);
    clinicIdMap[c.nameEn?.trim()] = String(c._id);
  }
  // Also map our codes
  for (const [code, nameAr] of Object.entries(CLINIC_MAP)) {
    // Try partial match
    const found = clinics.find((c: any) =>
      c.nameAr?.includes(nameAr) || nameAr.includes(c.nameAr) ||
      c.nameEn?.includes(nameAr) || nameAr.includes(c.nameEn)
    );
    if (found) clinicIdMap[code] = String(found._id);
  }

  // Build offer lookup
  const offers = await OfferModel.find({}).lean() as any[];
  const offerByPrice: Record<string, any> = {};
  for (const o of offers) {
    const price = parseFloat(o.subscriptionPriceKwd || "0");
    const key = String(Math.round(price));
    if (!offerByPrice[key]) offerByPrice[key] = o;
  }
  // Try to find offers by name patterns
  const offerByName: Record<string, any> = {};
  for (const o of offers) {
    const n = (o.name || "").toLowerCase();
    const nAr = o.nameAr || "";
    if (n.includes("mini") || nAr.includes("ميني")) offerByName["M"] = o;
    if (nAr.includes("صبايا") || n.includes("sabaya")) offerByName["S"] = o;
    if (n.includes("cashback") || nAr.includes("كاش باك")) offerByName["C"] = o;
  }

  function findOffer(svcCode: string, total: number): any {
    if (offerByName[svcCode]) return offerByName[svcCode];
    // Match by price
    const priceKey = String(Math.round(total));
    if (offerByPrice[priceKey]) return offerByPrice[priceKey];
    // Fallback: match by code
    if (["99","89","49","59"].includes(svcCode)) {
      return offerByPrice[svcCode] || offers[0];
    }
    if (svcCode === "1" || svcCode === "O") {
      // Single session or other - try to find by price
      return offerByPrice[priceKey] || offers[0];
    }
    return offers[0]; // fallback
  }

  let created = 0, skipped = 0, errors = 0;

  for (let i = 0; i < clients.length; i++) {
    const [name,phone,username,password,nationalId,svcCode,clinicCode,sessions,payCode,total,paid,pkgDate,expiry,remain,due] = clients[i];
    try {
      // 1. Create or find user
      const passwordHash = await bcrypt.hash(password, 10);
      const cleanPhone = phone.replace(/[^\d+]/g, "") || undefined;
      const isVerified = nationalId && nationalId.length > 5;
      const maskedId = nationalId ? nationalId.slice(0, 3) + "***" + nationalId.slice(-3) : undefined;

      let user: any = null;
      // Try to find existing user by username
      user = await UserModel.findOne({ username: username.toLowerCase() }).lean();
      if (!user && cleanPhone) {
        user = await UserModel.findOne({ phone: cleanPhone }).lean();
      }

      if (!user) {
        try {
          const doc = await UserModel.create({
            username: username.toLowerCase(),
            phone: cleanPhone,
            fullName: name,
            passwordHash,
            role: "customer",
            isActive: true,
            verificationStatus: isVerified ? "approved" : "unverified",
            civilIdNumberMasked: maskedId,
            publicToken: randomBytes(20).toString("hex"),
          });
          user = doc.toObject();
        } catch (e: any) {
          if (e.code === 11000) {
            // Duplicate - try without phone
            try {
              const doc = await UserModel.create({
                username: username.toLowerCase(),
                fullName: name,
                passwordHash,
                role: "customer",
                isActive: true,
                verificationStatus: isVerified ? "approved" : "unverified",
                civilIdNumberMasked: maskedId,
                publicToken: randomBytes(20).toString("hex"),
              });
              user = doc.toObject();
            } catch (e2: any) {
              if (e2.code === 11000) {
                // Username also duplicate - find existing
                user = await UserModel.findOne({ username: username.toLowerCase() }).lean();
              } else throw e2;
            }
          } else throw e;
        }
      }

      if (!user) { console.log(`[${i+1}] SKIP: could not create/find user ${username}`); skipped++; continue; }
      const userId = String(user._id);

      // Ensure wallet exists
      await WalletModel.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, unlockedKwd: "0.000", lockedKwd: "0.000", ceilingKwd: "0.000" } },
        { upsert: true }
      );

      // 2. Skip if cancelled/no membership
      if (svcCode === "X" || (total === 0 && paid === 0 && sessions === 0)) {
        console.log(`[${i+1}] OK: ${name} (user only, cancelled/no membership)`);
        created++;
        continue;
      }

      // 3. Find offer and clinic
      const offer = findOffer(svcCode, total);
      if (!offer) { console.log(`[${i+1}] WARN: no offer for svc=${svcCode} total=${total}`); skipped++; continue; }

      const resolvedClinicId = clinicIdMap[clinicCode] || (clinicCode ? Object.values(clinicIdMap)[0] : undefined);

      // 4. Determine status and create UserOffer
      const pkgDateObj = pkgDate ? new Date(pkgDate) : new Date();
      const expiryDateObj = expiry ? new Date(expiry) : new Date(pkgDateObj.getTime() + (offer.validityDays || 365) * 86400000);
      const totalKwd = total.toFixed(3);
      const paidKwd = paid.toFixed(3);

      let uoStatus: string;
      let purchaseMode: string;
      let installmentCount: number | undefined;
      let installmentsPaid = 0;

      if (payCode === "D") {
        uoStatus = "reserved";
        purchaseMode = "deposit";
      } else if (payCode === "I") {
        purchaseMode = "installments";
        // Determine installment details
        const remainKwd = remain || (total - paid);
        if (remainKwd <= 0) {
          uoStatus = "active";
          installmentCount = 3;
          installmentsPaid = 3;
        } else {
          uoStatus = "active";
          // Figure out how many installments paid
          if (paid >= total * 0.66) { installmentCount = 3; installmentsPaid = 2; }
          else if (paid >= total * 0.33) { installmentCount = 3; installmentsPaid = 1; }
          else { installmentCount = 3; installmentsPaid = 1; }
        }
      } else {
        uoStatus = paid >= total && total > 0 ? "active" : (total === 0 ? "active" : "pending_payment");
        purchaseMode = "full";
      }

      // Build installment schedule
      let schedule: any[] = [];
      if (purchaseMode === "installments" && installmentCount) {
        const eachAmt = (total / installmentCount).toFixed(3);
        for (let j = 0; j < installmentCount; j++) {
          const dueDate = new Date(pkgDateObj.getTime() + j * 30 * 86400000);
          schedule.push({
            number: j + 1,
            amountKwd: eachAmt,
            dueDate,
            paid: j < installmentsPaid,
            paidAt: j < installmentsPaid ? dueDate : null,
          });
        }
        // Set last unpaid installment due date from data
        if (due && due !== "pending" && schedule.length > installmentsPaid) {
          schedule[installmentsPaid].dueDate = new Date(due);
        }
      }

      const uo = await UserOfferModel.create({
        userId,
        offerId: offer._id,
        clinicId: resolvedClinicId ? new mongoose.Types.ObjectId(resolvedClinicId) : offer.clinicId || (offer.clinicIds?.[0]),
        status: uoStatus,
        purchaseMode,
        paymentMethod: "cash",
        paymentAmountKwd: totalKwd,
        cashbackAppliedKwd: "0.000",
        membershipType: offer.membershipType,
        activatedAt: uoStatus === "active" ? pkgDateObj : undefined,
        expiresAt: uoStatus === "active" ? expiryDateObj : undefined,
        sessionsUsed: 0,
        installmentCount: purchaseMode === "installments" ? installmentCount : undefined,
        installmentsPaid: purchaseMode === "installments" ? installmentsPaid : 0,
        installmentSchedule: schedule.length > 0 ? schedule : undefined,
        nextInstallmentDueAt: schedule.length > 0 && installmentsPaid! < schedule.length ? schedule[installmentsPaid!].dueDate : undefined,
        paymentConfirmedBy: "seed",
        paymentConfirmedAt: pkgDateObj,
      });

      // 5. Create payment(s)
      if (paid > 0) {
        if (purchaseMode === "installments" && installmentsPaid! > 0) {
          const eachAmt = (total / (installmentCount || 3)).toFixed(3);
          for (let j = 0; j < installmentsPaid!; j++) {
            await PaymentModel.create({
              userId,
              offerId: offer._id,
              userOfferId: uo._id,
              amountKwd: eachAmt,
              grossAmountKwd: eachAmt,
              cashbackAppliedKwd: "0.000",
              method: "cash",
              purpose: j === 0 ? "enrollment_full" : "installment",
              status: "completed",
              provider: "manual",
              isManual: true,
              manualLabel: "Seed Import",
              confirmedBy: "seed",
              confirmedAt: pkgDateObj,
              installmentNumber: j + 1,
              clinicId: resolvedClinicId ? new mongoose.Types.ObjectId(resolvedClinicId) : undefined,
            });
          }
        } else {
          await PaymentModel.create({
            userId,
            offerId: offer._id,
            userOfferId: uo._id,
            amountKwd: paidKwd,
            grossAmountKwd: paidKwd,
            cashbackAppliedKwd: "0.000",
            method: "cash",
            purpose: payCode === "D" ? "deposit" : "enrollment_full",
            status: "completed",
            provider: "manual",
            isManual: true,
            manualLabel: "Seed Import",
            confirmedBy: "seed",
            confirmedAt: pkgDateObj,
            clinicId: resolvedClinicId ? new mongoose.Types.ObjectId(resolvedClinicId) : undefined,
          });
        }
      }

      console.log(`[${i+1}] OK: ${name} | ${username} | ${svcCode} | ${payCode} | ${paid}/${total} KD`);
      created++;
    } catch (e: any) {
      console.error(`[${i+1}] ERR: ${name} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
