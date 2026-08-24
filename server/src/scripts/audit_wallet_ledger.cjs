const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const UserSchema = new mongoose.Schema({ fullName: String }, { strict: false });
const User = mongoose.model("AuditUser", UserSchema, "users");

const WalletSchema = new mongoose.Schema({ userId: String, unlockedKwd: String, lockedKwd: String, ceilingKwd: String }, { strict: false });
const Wallet = mongoose.model("AuditWallet", WalletSchema, "wallets");

const WalletTxnSchema = new mongoose.Schema({ userId: String, type: String, amountKwd: String }, { strict: false });
const WalletTxn = mongoose.model("AuditWalletTxn", WalletTxnSchema, "wallettxns");

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for Wallet Audit.\n");

  console.log("Loading all wallets...");
  const wallets = await Wallet.find({}).lean();
  console.log(`Loaded ${wallets.length} wallets.`);

  console.log("Loading all wallet transactions...");
  const txs = await WalletTxn.find({}).lean();
  console.log(`Loaded ${txs.length} transactions.`);

  console.log("Loading users for name mapping...");
  const users = await User.find({}).select("fullName").lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.fullName]));
  console.log("Users loaded.");

  // Group transactions by userId in memory
  const txsByUserId = {};
  for (const tx of txs) {
    if (!tx.userId) continue;
    const uid = tx.userId.toString();
    if (!txsByUserId[uid]) {
      txsByUserId[uid] = [];
    }
    txsByUserId[uid].push(tx);
  }

  console.log("\nAuditing ledger balance matching...");

  let perfectMatchCount = 0;
  let mismatchCount = 0;
  const mismatchList = [];

  for (const w of wallets) {
    const uid = w.userId ? w.userId.toString() : null;
    const userTxs = uid ? (txsByUserId[uid] || []) : [];
    const customerName = userMap[uid] || uid || "Unknown User";

    let computedLocked = 0;
    let computedUnlocked = 0;

    for (const tx of userTxs) {
      const amt = parseFloat(tx.amountKwd || "0");
      switch (tx.type) {
        case "offer_cashback_credit":
          computedLocked += amt;
          break;
        case "unlock":
        case "signup_bonus":
        case "installment_unlock":
          computedLocked -= amt;
          computedUnlocked += amt;
          break;
        case "session_reward":
        case "invoice_reward":
          computedUnlocked += amt;
          break;
        case "deduction":
          computedUnlocked -= amt;
          break;
        case "adjustment":
          computedUnlocked += amt; // positive or negative
          break;
        case "reversal":
          computedUnlocked -= amt;
          break;
        default:
          break;
      }
    }

    const dbUnlocked = parseFloat(w.unlockedKwd || "0");
    const dbLocked = parseFloat(w.lockedKwd || "0");

    const diffUnlocked = Math.abs(computedUnlocked - dbUnlocked);
    const diffLocked = Math.abs(computedLocked - dbLocked);

    if (diffUnlocked > 0.005 || diffLocked > 0.005) {
      mismatchCount++;
      mismatchList.push({
        customerName,
        userId: uid,
        dbUnlocked,
        computedUnlocked,
        diffUnlocked,
        dbLocked,
        computedLocked,
        diffLocked,
        txnLength: userTxs.length
      });
    } else {
      perfectMatchCount++;
    }
  }

  // Print results
  for (const m of mismatchList) {
    console.log(`❌ Mismatch for: ${m.customerName} (${m.userId})`);
    console.log(`   Unlocked: DB = ${m.dbUnlocked.toFixed(3)} | Ledger = ${m.computedUnlocked.toFixed(3)} (Diff = ${m.diffUnlocked.toFixed(3)})`);
    console.log(`   Locked  : DB = ${m.dbLocked.toFixed(3)} | Ledger = ${m.computedLocked.toFixed(3)} (Diff = ${m.diffLocked.toFixed(3)})`);
    console.log(`   Total transactions: ${m.txnLength}`);
    console.log();
  }

  console.log("========================================= ");
  console.log(`  AUDIT COMPLETED:`);
  console.log(`  Perfect Matches: ${perfectMatchCount}`);
  console.log(`  Mismatches found: ${mismatchCount}`);
  console.log("========================================= ");

  await mongoose.disconnect();
}

run().catch(console.error);
