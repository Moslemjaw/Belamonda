const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const UserSchema = new mongoose.Schema({ fullName: String, phone: String, status: String }, { strict: false });
const User = mongoose.model("DeepUser", UserSchema, "users");

const WalletSchema = new mongoose.Schema({}, { strict: false });
const Wallet = mongoose.model("DeepWallet", WalletSchema, "wallets");

const WalletTxnSchema = new mongoose.Schema({}, { strict: false });
const WalletTxn = mongoose.model("DeepWalletTxn", WalletTxnSchema, "wallettxns");

const UserOfferSchema = new mongoose.Schema({}, { strict: false });
const UserOffer = mongoose.model("DeepUserOffer", UserOfferSchema, "useroffers");

const InvoiceSchema = new mongoose.Schema({}, { strict: false });
const Invoice = mongoose.model("DeepInvoice", InvoiceSchema, "invoices");

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("=== COMPREHENSIVE WALLET DEEP AUDIT ===\n");

  const wallets = await Wallet.find({}).lean();
  const txns = await WalletTxn.find({}).lean();
  const users = await User.find({}).select("fullName phone status").lean();
  const userOffers = await UserOffer.find({}).lean();

  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
  const userIdSet = new Set(users.map(u => u._id.toString()));

  // Group txns by userId
  const txnsByUser = {};
  for (const tx of txns) {
    const uid = tx.userId?.toString();
    if (!uid) continue;
    if (!txnsByUser[uid]) txnsByUser[uid] = [];
    txnsByUser[uid].push(tx);
  }

  const results = {
    totalWallets: wallets.length,
    totalTxns: txns.length,
    totalUsers: users.length,
  };

  // ═══════════════════════════════════════
  // AUDIT 1: BALANCE MISMATCHES (re-verify)
  // ═══════════════════════════════════════
  console.log("── AUDIT 1: Balance Ledger Verification ──");
  let balanceMismatches = [];
  let perfectMatches = 0;

  for (const w of wallets) {
    const uid = w.userId?.toString();
    const userTxs = uid ? (txnsByUser[uid] || []) : [];
    let compLocked = 0, compUnlocked = 0;

    for (const tx of userTxs) {
      const amt = parseFloat(tx.amountKwd || "0");
      switch (tx.type) {
        case "offer_cashback_credit": compLocked += amt; break;
        case "unlock": case "signup_bonus": case "installment_unlock":
          compLocked -= amt; compUnlocked += amt; break;
        case "session_reward": case "invoice_reward":
          compUnlocked += amt; break;
        case "deduction": compUnlocked -= amt; break;
        case "adjustment": compUnlocked += amt; break;
        case "reversal": compUnlocked -= amt; break;
      }
    }

    const dbUnlocked = parseFloat(w.unlockedKwd || "0");
    const dbLocked = parseFloat(w.lockedKwd || "0");

    if (Math.abs(compUnlocked - dbUnlocked) > 0.005 || Math.abs(compLocked - dbLocked) > 0.005) {
      const name = userMap[uid]?.fullName || uid;
      balanceMismatches.push({ name, uid, dbUnlocked, compUnlocked, dbLocked, compLocked, txCount: userTxs.length });
    } else {
      perfectMatches++;
    }
  }
  console.log(`  ✅ Perfect matches: ${perfectMatches}`);
  console.log(`  ❌ Mismatches: ${balanceMismatches.length}`);
  for (const m of balanceMismatches) {
    console.log(`    → ${m.name}: Unlocked DB=${m.dbUnlocked} vs Ledger=${m.compUnlocked.toFixed(3)}, Locked DB=${m.dbLocked} vs Ledger=${m.compLocked.toFixed(3)}`);
  }

  // ═══════════════════════════════════════
  // AUDIT 2: NEGATIVE BALANCES
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 2: Negative Balance Check ──");
  let negativeBalances = [];
  for (const w of wallets) {
    const uid = w.userId?.toString();
    const name = userMap[uid]?.fullName || uid;
    const unlocked = parseFloat(w.unlockedKwd || "0");
    const locked = parseFloat(w.lockedKwd || "0");
    const ceiling = parseFloat(w.ceilingKwd || "0");
    if (unlocked < -0.005) negativeBalances.push({ name, uid, field: "unlocked", value: unlocked });
    if (locked < -0.005) negativeBalances.push({ name, uid, field: "locked", value: locked });
    if (ceiling < -0.005) negativeBalances.push({ name, uid, field: "ceiling", value: ceiling });
  }
  console.log(`  Found ${negativeBalances.length} negative balances`);
  for (const n of negativeBalances) {
    console.log(`  ❌ ${n.name}: ${n.field} = ${n.value.toFixed(3)}`);
  }

  // ═══════════════════════════════════════
  // AUDIT 3: DUPLICATE WALLETS (same userId)
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 3: Duplicate Wallet Check ──");
  const walletsByUser = {};
  for (const w of wallets) {
    const uid = w.userId?.toString();
    if (!uid) continue;
    if (!walletsByUser[uid]) walletsByUser[uid] = [];
    walletsByUser[uid].push(w);
  }
  const duplicateWallets = Object.entries(walletsByUser).filter(([, ws]) => ws.length > 1);
  console.log(`  Found ${duplicateWallets.length} users with duplicate wallets`);
  for (const [uid, ws] of duplicateWallets) {
    const name = userMap[uid]?.fullName || uid;
    console.log(`  ❌ ${name}: ${ws.length} wallets`);
    for (const w of ws) {
      console.log(`    → Wallet ${w._id}: unlocked=${w.unlockedKwd}, locked=${w.lockedKwd}, ceiling=${w.ceilingKwd}`);
    }
  }

  // ═══════════════════════════════════════
  // AUDIT 4: ORPHANED WALLETS / USERS
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 4: Orphan Check ──");
  const walletsWithoutUser = wallets.filter(w => !userIdSet.has(w.userId?.toString()));
  console.log(`  Wallets without matching user: ${walletsWithoutUser.length}`);
  for (const w of walletsWithoutUser.slice(0, 10)) {
    console.log(`  ⚠️ Wallet ${w._id} → userId ${w.userId} (not found in users collection)`);
  }

  const walletUserIds = new Set(wallets.map(w => w.userId?.toString()).filter(Boolean));
  const usersWithoutWallet = users.filter(u => !walletUserIds.has(u._id.toString()));
  console.log(`  Users without wallet: ${usersWithoutWallet.length}`);
  for (const u of usersWithoutWallet.slice(0, 10)) {
    console.log(`  ⚠️ ${u.fullName || u.phone} (${u._id}) - status: ${u.status || "unknown"}`);
  }

  // ═══════════════════════════════════════
  // AUDIT 5: TRANSACTION ANOMALIES
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 5: Transaction Anomalies ──");
  const knownTypes = ["offer_cashback_credit", "unlock", "signup_bonus", "installment_unlock", "session_reward", "invoice_reward", "deduction", "adjustment", "reversal"];
  const unknownTypeTxns = txns.filter(tx => !knownTypes.includes(tx.type));
  const zeroAmountTxns = txns.filter(tx => parseFloat(tx.amountKwd || "0") === 0);
  const missingFieldTxns = txns.filter(tx => !tx.userId || !tx.type || !tx.amountKwd);
  const orphanTxns = txns.filter(tx => !userIdSet.has(tx.userId?.toString()));

  console.log(`  Unknown transaction types: ${unknownTypeTxns.length}`);
  // Show type distribution
  const typeCounts = {};
  for (const tx of unknownTypeTxns) {
    typeCounts[tx.type || "null"] = (typeCounts[tx.type || "null"] || 0) + 1;
  }
  for (const [t, c] of Object.entries(typeCounts)) {
    console.log(`    → "${t}": ${c} transactions`);
  }

  console.log(`  Zero-amount transactions: ${zeroAmountTxns.length}`);
  console.log(`  Missing required fields: ${missingFieldTxns.length}`);
  console.log(`  Orphan transactions (user deleted): ${orphanTxns.length}`);
  for (const t of orphanTxns.slice(0, 5)) {
    console.log(`    → Txn ${t._id}: userId=${t.userId}, type=${t.type}, amount=${t.amountKwd}`);
  }

  // ═══════════════════════════════════════
  // AUDIT 6: CEILING INTEGRITY
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 6: Ceiling Integrity ──");
  let ceilingIssues = [];
  for (const w of wallets) {
    const uid = w.userId?.toString();
    const userTxs = uid ? (txnsByUser[uid] || []) : [];
    const ceiling = parseFloat(w.ceilingKwd || "0");
    const unlocked = parseFloat(w.unlockedKwd || "0");
    const locked = parseFloat(w.lockedKwd || "0");

    // Ceiling should be >= unlocked + locked (total earned should be >= remaining)
    const totalRemaining = unlocked + locked;
    if (ceiling > 0 && totalRemaining > ceiling + 0.01) {
      const name = userMap[uid]?.fullName || uid;
      ceilingIssues.push({ name, uid, ceiling, unlocked, locked, totalRemaining, txCount: userTxs.length });
    }
  }
  console.log(`  Wallets where unlocked+locked > ceiling: ${ceilingIssues.length}`);
  for (const c of ceilingIssues) {
    console.log(`  ❌ ${c.name}: ceiling=${c.ceiling.toFixed(3)}, unlocked+locked=${c.totalRemaining.toFixed(3)} (diff=${(c.totalRemaining - c.ceiling).toFixed(3)})`);
  }

  // ═══════════════════════════════════════
  // AUDIT 7: TRANSACTION TYPE DISTRIBUTION
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 7: Transaction Type Distribution ──");
  const allTypeCounts = {};
  let totalAmount = {};
  for (const tx of txns) {
    const t = tx.type || "null";
    allTypeCounts[t] = (allTypeCounts[t] || 0) + 1;
    totalAmount[t] = (totalAmount[t] || 0) + parseFloat(tx.amountKwd || "0");
  }
  for (const [t, c] of Object.entries(allTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c} txns, total ${totalAmount[t].toFixed(3)} KWD`);
  }

  // ═══════════════════════════════════════
  // AUDIT 8: HIGH-VALUE WALLET CHECK (top 10)
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 8: Top 10 Wallets by Total Balance ──");
  const ranked = wallets
    .map(w => ({
      name: userMap[w.userId?.toString()]?.fullName || w.userId,
      uid: w.userId,
      unlocked: parseFloat(w.unlockedKwd || "0"),
      locked: parseFloat(w.lockedKwd || "0"),
      ceiling: parseFloat(w.ceilingKwd || "0"),
      total: parseFloat(w.unlockedKwd || "0") + parseFloat(w.lockedKwd || "0")
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`  ${i + 1}. ${r.name}: Total=${r.total.toFixed(3)} KWD (unlocked=${r.unlocked.toFixed(3)}, locked=${r.locked.toFixed(3)}, ceiling=${r.ceiling.toFixed(3)})`);
  }

  // ═══════════════════════════════════════
  // AUDIT 9: WALLETS WITH ZERO BALANCE BUT TRANSACTIONS
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 9: Zero Balance Wallets with Transactions ──");
  let zeroBut = [];
  for (const w of wallets) {
    const uid = w.userId?.toString();
    const unlocked = parseFloat(w.unlockedKwd || "0");
    const locked = parseFloat(w.lockedKwd || "0");
    const txCount = (txnsByUser[uid] || []).length;
    if (unlocked === 0 && locked === 0 && txCount > 0) {
      const name = userMap[uid]?.fullName || uid;
      zeroBut.push({ name, uid, txCount, ceiling: parseFloat(w.ceilingKwd || "0") });
    }
  }
  console.log(`  Found ${zeroBut.length} wallets with zero balance but existing transactions`);
  for (const z of zeroBut.slice(0, 15)) {
    console.log(`    → ${z.name}: ${z.txCount} txns, ceiling=${z.ceiling.toFixed(3)}`);
  }

  // ═══════════════════════════════════════
  // AUDIT 10: WALLETS WITH NON-ZERO BALANCE BUT NO TRANSACTIONS
  // ═══════════════════════════════════════
  console.log("\n── AUDIT 10: Non-Zero Balance Wallets with No Transactions ──");
  let nonZeroNoTxn = [];
  for (const w of wallets) {
    const uid = w.userId?.toString();
    const unlocked = parseFloat(w.unlockedKwd || "0");
    const locked = parseFloat(w.lockedKwd || "0");
    const txCount = (txnsByUser[uid] || []).length;
    if ((unlocked > 0.005 || locked > 0.005) && txCount === 0) {
      const name = userMap[uid]?.fullName || uid;
      nonZeroNoTxn.push({ name, uid, unlocked, locked, ceiling: parseFloat(w.ceilingKwd || "0") });
    }
  }
  console.log(`  Found ${nonZeroNoTxn.length} wallets with balance but no transaction records`);
  for (const n of nonZeroNoTxn) {
    console.log(`  ❌ ${n.name}: unlocked=${n.unlocked.toFixed(3)}, locked=${n.locked.toFixed(3)}, ceiling=${n.ceiling.toFixed(3)}`);
  }

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  COMPREHENSIVE AUDIT SUMMARY");
  console.log("═".repeat(60));
  console.log(`  Total Wallets: ${wallets.length}`);
  console.log(`  Total Transactions: ${txns.length}`);
  console.log(`  Balance Mismatches: ${balanceMismatches.length}`);
  console.log(`  Negative Balances: ${negativeBalances.length}`);
  console.log(`  Duplicate Wallets: ${duplicateWallets.length}`);
  console.log(`  Orphaned Wallets: ${walletsWithoutUser.length}`);
  console.log(`  Users Without Wallet: ${usersWithoutWallet.length}`);
  console.log(`  Unknown Txn Types: ${unknownTypeTxns.length}`);
  console.log(`  Zero-Amount Txns: ${zeroAmountTxns.length}`);
  console.log(`  Orphan Txns: ${orphanTxns.length}`);
  console.log(`  Ceiling Violations: ${ceilingIssues.length}`);
  console.log(`  Zero Balance + Txns: ${zeroBut.length}`);
  console.log(`  Non-Zero Balance, No Txns: ${nonZeroNoTxn.length}`);
  console.log("═".repeat(60));

  await mongoose.disconnect();
}

run().catch(console.error);
