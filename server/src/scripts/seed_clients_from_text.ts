import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// ── Models ───────────────────────────────────────────────────────────────────
import { UserModel } from "../models/user.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { OfferModel } from "../models/offer.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { WalletModel, WalletTxnModel } from "../models/kyc.model.js";
import { seedDefaultOffers } from "../bootstrap/seedDefaults.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Format a number to KWD string "99.000" */
const toKwd = (n: number): string => n.toFixed(3);

/** Extract first match group or undefined */
const ext = (text: string, re: RegExp): string | undefined => {
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
};

// ── Parser ───────────────────────────────────────────────────────────────────
interface ParsedSession {
  date: Date;
  clinicName: string;
  cost: number;
  statusRaw: string;
}

interface ParsedClient {
  idx: number;
  fullName: string;
  nationalId?: string;
  phone?: string;
  clinicName: string;
  salesRep?: string;
  membershipService?: string;
  packageType?: string;
  packageDate?: string;
  expiryDate?: string;
  paymentStatus: string;
  totalKwd: number;
  amountPaid: number;
  remainingBalance: number;
  installmentDue?: string;
  totalSessions: number;
  sessionsCompleted: number;
  username: string;
  password: string;
  sessions: ParsedSession[];
}

function parseClients(text: string): ParsedClient[] {
  const clients: ParsedClient[] = [];

  // Split on the long dash separator (at least 40 dashes)
  const blocks = text.split(/─{40,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Match client number + name: "1.  حماد لطفي"
    const nameMatch = trimmed.match(/^(\d+)\.\s+(.+?)[\r\n]/);
    if (!nameMatch) continue;

    const idx = parseInt(nameMatch[1], 10);
    const fullName = nameMatch[2].trim();

    const nationalId = ext(trimmed, /National ID:\s*(.+)/);
    const phoneRaw = ext(trimmed, /Phone:\s*(.+)/);
    // Take first phone number only, strip spaces
    const phone = phoneRaw?.split(/[\/,]/)[0].replace(/\s+/g, "").trim();
    const clinicName = ext(trimmed, /Clinic:\s*(.+)/) || "Main Clinic";
    const salesRep = ext(trimmed, /Sales Rep:\s*(.+)/);
    const membershipService = ext(trimmed, /Membership \/ Service:\s*(.+)/);
    const packageType = ext(trimmed, /Package Type:\s*(.+)/);
    const packageDate = ext(trimmed, /Package Date:\s*(.+)/);
    const expiryDate = ext(trimmed, /Expiry Date:\s*(.+)/);

    const paymentStatus = ext(trimmed, /Payment Status:\s*(.+)/) || "Fully Paid";
    const totalKwd = parseFloat(ext(trimmed, /Total \(KD\):\s*([\d.]+)/) || "0");
    const amountPaid = parseFloat(ext(trimmed, /Amount Paid \(KD\):\s*([\d.]+)/) || "0");
    const remainingBalance = parseFloat(ext(trimmed, /Remaining Balance \(KD\):\s*([\d.]+)/) || "0");
    const installmentDue = ext(trimmed, /(?:Installment|Due):\s*(?:Due:\s*)?(\d{4}-\d{2}-\d{2})/);

    const totalSessions = parseInt(ext(trimmed, /Total Sessions in Package:\s*(\d+)/) || "0", 10);
    const sessionsCompleted = parseInt(ext(trimmed, /Sessions Completed:\s*(\d+)/) || "0", 10);

    const username = ext(trimmed, /Username:\s*(\S+)/);
    const password = ext(trimmed, /Password:\s*(\S+)/);

    if (!username || !password) continue;
    if (membershipService?.includes("ملغي") || packageType?.includes("ملغي")) continue;

    // Parse session history lines
    const sessions: ParsedSession[] = [];
    // Match lines like: •	Session #1 — 2026-01-14: مارينا 2  |  Cost: 8 KD  |  Status: معتمد
    const sessionRegex = /Session\s+#[^\n]*?—\s*(\d{4}-\d{2}-\d{2}):\s*([^|]+?)(?:\s*\|\s*Cost:\s*(\d+)\s*KD)?(?:\s*\|\s*Status:\s*([^\n|]+))?/g;
    let sm;
    while ((sm = sessionRegex.exec(trimmed)) !== null) {
      sessions.push({
        date: new Date(sm[1]),
        clinicName: sm[2].trim(),
        cost: sm[3] ? parseFloat(sm[3]) : 0,
        statusRaw: (sm[4] || "").trim()
      });
    }

    clients.push({
      idx,
      fullName,
      nationalId,
      phone,
      clinicName,
      salesRep,
      membershipService,
      packageType,
      packageDate,
      expiryDate,
      paymentStatus,
      totalKwd,
      amountPaid,
      remainingBalance,
      installmentDue,
      totalSessions,
      sessionsCompleted,
      username,
      password,
      sessions
    });
  }

  return clients;
}

// ── Offer name mapping ───────────────────────────────────────────────────────
/** Maps raw Arabic/English client strings to the canonical offer name in the DB */
function mapToOfferName(raw: string): string {
  const s = raw.trim();
  if (s === "جلسة واحدة") return "Single Session";
  if (s === "باكيج 99") return "Naumi Plus";
  if (s === "باكيج 89" || s === "جمالي") return "Jamali";
  if (s === "أخرى") return "Other";
  if (s === "Mini Jamali") return "Mini Jamali";
  if (s === "باكيج 59") return "Package 59";
  if (s === "باكيج 49") return "Package 49";
  if (s === "صبايا") return "Sabaya";
  if (s === "جلسة مع كاش باك") return "Single Session with Cashback";
  // Fallback partial matches
  if (s.includes("99")) return "Naumi Plus";
  if (s.includes("89") || s.includes("جمالي")) return "Jamali";
  if (s.includes("49")) return "Package 49";
  if (s.includes("59")) return "Package 59";
  if (s.includes("صبايا")) return "Sabaya";
  if (s.includes("كاش باك") || s.toLowerCase().includes("cashback")) return "Single Session with Cashback";
  return "General Service";
}

// ── Main seed function ───────────────────────────────────────────────────────
async function seed() {
  const mongoUri = process.env.MONGODB_URI!;
  if (!mongoUri) { console.error("MONGODB_URI not set"); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  // Read text file
  const filePath = path.resolve(process.cwd(), "..", "clients_data_mock.txt");
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const text = fs.readFileSync(filePath, "utf8");
  const clients = parseClients(text);
  console.log(`📋 Parsed ${clients.length} clients from text file`);

  if (clients.length === 0) {
    console.error("❌ No clients parsed — check file format");
    process.exit(1);
  }

  // ── Step 1: Wipe old customer data + stale offers + wallets ─────────────
  console.log("🗑️  Deleting old customer data...");
  const delUsers = await UserModel.deleteMany({ role: "customer" });
  const delUO = await UserOfferModel.deleteMany({});
  const delBS = await BookingSessionModel.deleteMany({});
  const delPay = await PaymentModel.deleteMany({});
  const delOffers = await OfferModel.deleteMany({});
  const delWallets = await WalletModel.deleteMany({});
  const delWalletTxns = await WalletTxnModel.deleteMany({});
  console.log(`   Deleted: ${delUsers.deletedCount} users, ${delUO.deletedCount} userOffers, ${delBS.deletedCount} sessions, ${delPay.deletedCount} payments`);
  console.log(`   Deleted: ${delOffers.deletedCount} offers, ${delWallets.deletedCount} wallets, ${delWalletTxns.deletedCount} walletTxns`);

  // ── Step 2: Collect & ensure all clinics ────────────────────────────────
  const allClinicNames = new Set<string>();
  for (const c of clients) {
    allClinicNames.add(c.clinicName);
    for (const s of c.sessions) {
      allClinicNames.add(s.clinicName);
    }
  }
  console.log(`🏥 Unique clinics found: ${allClinicNames.size}`);

  const clinicMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const name of allClinicNames) {
    let clinic = await ClinicModel.findOne({ $or: [{ nameAr: name }, { nameEn: name }] });
    if (!clinic) {
      clinic = await ClinicModel.create({
        nameEn: name,
        nameAr: name,
        active: true
      });
      console.log(`   ➕ Created clinic: ${name}`);
    } else {
      console.log(`   ✓ Clinic exists: ${name} (${clinic._id})`);
    }
    clinicMap[name] = clinic._id;
  }

  // ── Step 3: Seed canonical offers & build lookup map ─────────────────────
  console.log("📦 Seeding canonical default offers...");
  await seedDefaultOffers();

  // Map each client's raw offer string → canonical name
  for (const c of clients) {
    const raw = c.membershipService || c.packageType || "General Service";
    c.membershipService = mapToOfferName(raw);
  }

  // Build offerMap from all offers now in the DB
  const offerMap: Record<string, mongoose.Types.ObjectId> = {};
  const allDbOffers = await OfferModel.find({}).lean() as Array<{ _id: mongoose.Types.ObjectId; name: string; membershipType?: string }>;
  for (const o of allDbOffers) {
    offerMap[o.name] = o._id;
  }
  console.log(`   📦 ${allDbOffers.length} offers loaded into map`);

  // ── Step 4: Create users, userOffers, payments, sessions ────────────────
  let userCount = 0;
  let sessionCount = 0;
  let paymentCount = 0;
  const credentials: { idx: number; name: string; username: string; password: string }[] = [];

  for (const c of clients) {
    try {
      const clinicId = clinicMap[c.clinicName];
      const offerName = c.membershipService || "General Service";
      const offerId = offerMap[offerName];
      if (!offerId) {
        console.warn(`   ⚠️ No offer found for "${offerName}" — client #${c.idx} (${c.fullName}), skipping`);
        continue;
      }
      // Look up the offer doc to get its membershipType
      const offerDoc = allDbOffers.find(o => o.name === offerName);
      const isStandalone = offerName === "Single Session";
      const offerMembershipType = offerDoc?.membershipType;  // cashback | free_sessions | group | undefined

      // 4a. Create User
      const passwordHash = await bcrypt.hash(c.password, 10);
      
      const user = await UserModel.create({
        fullName: c.fullName,
        username: c.username.toLowerCase(),
        passwordHash,
        role: "customer",
        phone: c.phone || undefined,
        civilIdNumberMasked: c.nationalId || undefined,
        isActive: true,
        verificationStatus: "approved",
        clinicId
      });
      userCount++;

      // 4b. Determine offer expiry
      let expiresAt: Date | undefined;
      if (c.expiryDate && !isNaN(new Date(c.expiryDate).getTime())) {
        expiresAt = new Date(c.expiryDate);
      } else if (c.packageDate && !isNaN(new Date(c.packageDate).getTime())) {
        expiresAt = new Date(c.packageDate);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Determine purchase mode
      let purchaseMode: "full" | "installments" | "deposit" = "full";
      let uoStatus: string = "active";
      if (c.paymentStatus.includes("Installments") || c.paymentStatus.includes("installment")) {
        purchaseMode = "installments";
      } else if (c.paymentStatus.includes("Deposit") || c.paymentStatus.includes("Overpaid")) {
        purchaseMode = "deposit";
      }
      if (c.membershipService?.includes("ملغي") || c.packageType?.includes("ملغي")) {
        uoStatus = "cancelled";
      }

      // Build installment schedule if applicable
      const installmentSchedule: any[] = [];
      if (purchaseMode === "installments" && c.totalKwd > 0) {
        const perInstallment = c.totalKwd / 3;
        const paid1 = c.amountPaid >= perInstallment;
        const paid2 = c.amountPaid >= perInstallment * 2;
        const paid3 = c.amountPaid >= c.totalKwd;
        const baseDate = c.packageDate && !isNaN(new Date(c.packageDate).getTime()) ? new Date(c.packageDate) : new Date();

        installmentSchedule.push(
          { number: 1, amountKwd: toKwd(perInstallment), dueDate: baseDate, paid: paid1, paidAt: paid1 ? baseDate : undefined },
          { number: 2, amountKwd: toKwd(perInstallment), dueDate: new Date(baseDate.getTime() + 30 * 86400000), paid: paid2, paidAt: paid2 ? new Date(baseDate.getTime() + 30 * 86400000) : undefined },
          { number: 3, amountKwd: toKwd(c.totalKwd - perInstallment * 2), dueDate: c.installmentDue && !isNaN(new Date(c.installmentDue).getTime()) ? new Date(c.installmentDue) : new Date(baseDate.getTime() + 60 * 86400000), paid: paid3 }
        );
      }

      // 4c. Compute cashback balance (for cashback memberships)
      const isCashbackMembership = offerMembershipType === "cashback";
      let currentCashbackBalance = 0;
      let signupCashbackAmount = 0;
      if (isCashbackMembership && offerDoc) {
        // Determine the starting cashback from the offer definition
        const offerFull = await OfferModel.findById(offerDoc._id).lean() as any;
        signupCashbackAmount = parseFloat(offerFull?.signupCashbackKwd || "0");
        // For per-session cashback offers (Naumi Plus), balance is session-driven not signup
        const perSessionCb = parseFloat(offerFull?.cashbackPerSessionKwd || "0");
        if (signupCashbackAmount > 0) {
          currentCashbackBalance = signupCashbackAmount;
          for (const s of c.sessions) {
            if (s.statusRaw.includes("معتمد") && !s.statusRaw.includes("غير")) {
              currentCashbackBalance -= s.cost;
            }
          }
          if (currentCashbackBalance < 0) currentCashbackBalance = 0;
        } else if (perSessionCb > 0) {
          // Naumi Plus: accumulate cashback from completed sessions
          const completedSessions = c.sessions.filter(s => s.statusRaw.includes("معتمد") && !s.statusRaw.includes("غير")).length;
          currentCashbackBalance = completedSessions * perSessionCb;
        }
      }

      // 4d. Create UserOffer
      const userOffer = await UserOfferModel.create({
        userId: user._id.toString(),
        offerId,
        clinicId,
        status: uoStatus,
        activatedAt: c.packageDate && !isNaN(new Date(c.packageDate).getTime()) ? new Date(c.packageDate) : new Date(),
        expiresAt,
        sessionsUsed: c.sessionsCompleted,
        purchaseMode,
        paymentAmountKwd: toKwd(c.amountPaid),
        paymentMethod: "cash",
        isStandalone,
        membershipType: isStandalone ? undefined : offerMembershipType,
        cashbackBalanceKwd: isCashbackMembership ? toKwd(currentCashbackBalance) : undefined,
        totalSignupCashbackKwd: isCashbackMembership && signupCashbackAmount > 0 ? toKwd(signupCashbackAmount) : undefined,
        installmentCount: purchaseMode === "installments" ? 3 : undefined,
        installmentsPaid: purchaseMode === "installments" ? Math.floor(c.amountPaid / (c.totalKwd / 3)) : undefined,
        installmentSchedule: installmentSchedule.length > 0 ? installmentSchedule : undefined,
        nextInstallmentDueAt: purchaseMode === "installments" && c.remainingBalance > 0 && c.installmentDue && !isNaN(new Date(c.installmentDue).getTime()) ? new Date(c.installmentDue) : undefined
      });

      // 4e. Create Wallet for cashback membership holders
      if (isCashbackMembership && currentCashbackBalance > 0) {
        await WalletModel.findOneAndUpdate(
          { userId: user._id.toString() },
          {
            $set: {
              userId: user._id.toString(),
              ceilingKwd: toKwd(signupCashbackAmount || currentCashbackBalance),
              unlockedKwd: toKwd(currentCashbackBalance),
              lockedKwd: "0.000"
            }
          },
          { upsert: true, new: true }
        );
      }

      // 4d. Create Payment(s)
      if (c.amountPaid > 0) {
        if (purchaseMode === "installments") {
          // Create one payment per paid installment
          for (const inst of installmentSchedule) {
            if (inst.paid) {
              await PaymentModel.create({
                userId: user._id.toString(),
                offerId,
                userOfferId: userOffer._id,
                clinicId,
                amountKwd: inst.amountKwd,
                method: "cash",
                purpose: inst.number === 1 ? "enrollment_full" : "installment",
                provider: "cs",
                installmentNumber: inst.number,
                status: "completed",
                confirmedAt: inst.paidAt || new Date(),
                isManual: true,
                notes: `Migration: Installment #${inst.number}`
              });
              paymentCount++;
            }
          }
        } else {
          await PaymentModel.create({
            userId: user._id.toString(),
            offerId,
            userOfferId: userOffer._id,
            clinicId,
            amountKwd: toKwd(c.amountPaid),
            method: "cash",
            purpose: "enrollment_full",
            provider: "cs",
            status: "completed",
            confirmedAt: c.packageDate && !isNaN(new Date(c.packageDate).getTime()) ? new Date(c.packageDate) : new Date(),
            isManual: true,
            notes: "Migration: Full payment"
          });
          paymentCount++;
        }
      }

      // 4e. Create BookingSessions
      for (const s of c.sessions) {
        const sClinicId = clinicMap[s.clinicName] || clinicId;

        let sessionStatus: "scheduled" | "completed" | "no_show" | "cancelled" = "scheduled";
        if (s.statusRaw.includes("معتمد") && !s.statusRaw.includes("غير")) {
          sessionStatus = "completed";
        } else if (s.statusRaw.includes("غير معتمد")) {
          sessionStatus = "cancelled";
        } else if (s.statusRaw.includes("ملغي")) {
          sessionStatus = "cancelled";
        }

        // Create a session payment if there's a cost
        let sessionPaymentId: mongoose.Types.ObjectId | undefined;
        if (s.cost > 0) {
          const sp = await PaymentModel.create({
            userId: user._id.toString(),
            offerId,
            userOfferId: userOffer._id,
            clinicId: sClinicId,
            amountKwd: toKwd(s.cost),
            method: "cash",
            purpose: "session_payment",
            provider: "cs",
            status: sessionStatus === "completed" ? "completed" : "pending",
            confirmedAt: sessionStatus === "completed" ? s.date : undefined,
            isManual: true,
            notes: `Migration: Session on ${s.date.toISOString().slice(0, 10)}`
          });
          sessionPaymentId = sp._id;
          paymentCount++;
        }

        await BookingSessionModel.create({
          userOfferId: userOffer._id,
          userId: user._id.toString(),
          offerId,
          clinicId: sClinicId,
          scheduledAt: s.date,
          status: sessionStatus,
          scheduledBy: "system",
          completedAt: sessionStatus === "completed" ? s.date : undefined,
          markedBy: sessionStatus === "completed" ? "system" : undefined,
          paymentId: sessionPaymentId,
          notes: `Migrated session`
        });
        sessionCount++;
      }

      credentials.push({ idx: c.idx, name: c.fullName, username: c.username, password: c.password });
      if (userCount % 10 === 0) console.log(`   ... processed ${userCount} users`);
    } catch (err: any) {
      console.error(`❌ Error on client #${c.idx} (${c.fullName}):`, err.message);
    }
  }

  // ── Step 5: Save credentials ────────────────────────────────────────────
  const credPath = path.resolve(process.cwd(), "..", "client_credentials.json");
  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), "utf8");

  console.log("\n" + "═".repeat(60));
  console.log(`✅ Migration complete!`);
  console.log(`   👥 Users created:     ${userCount}`);
  console.log(`   📅 Sessions created:  ${sessionCount}`);
  console.log(`   💳 Payments created:  ${paymentCount}`);
  console.log(`   🏥 Clinics ensured:   ${Object.keys(clinicMap).length}`);
  console.log(`   📦 Offers ensured:    ${Object.keys(offerMap).length}`);
  console.log(`   📄 Credentials saved: ${credPath}`);
  console.log("═".repeat(60));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
