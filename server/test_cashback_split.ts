import { getEffectiveSignupCashback } from "./src/services/checkout.service.js";

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAILED: ${message}. Expected ${expected}, got ${actual}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log("Testing Cashback Splitting Logic...");

  // Test 1: Normal non-group offer
  const normalOffer = {
    signupCashbackKwd: "100.000",
    isGroupOffer: false,
  };
  assertEqual(getEffectiveSignupCashback(normalOffer), "100.000", "Normal offer should give full cashback");

  // Test 2: Group offer with 2 members
  const groupOffer2 = {
    signupCashbackKwd: "100.000",
    isGroupOffer: true,
    groupSizeRequired: 2,
    groupRewardType: "split_bill",
  };
  assertEqual(getEffectiveSignupCashback(groupOffer2), "50.000", "Group offer (size 2) should split 100 KD into 50 KD");

  // Test 3: Group offer with 3 members and uneven split
  const groupOffer3 = {
    signupCashbackKwd: "100.000",
    isGroupOffer: true,
    groupSizeRequired: 3,
  };
  // 100 KD / 3 = 33.333333 KD -> floored to mils = 33.333
  assertEqual(getEffectiveSignupCashback(groupOffer3), "33.333", "Group offer (size 3) should split 100 KD into 33.333 KD");

  // Test 4: Missing signupCashbackKwd
  const noCashbackOffer = {
    isGroupOffer: true,
    groupSizeRequired: 4,
  };
  assertEqual(getEffectiveSignupCashback(noCashbackOffer), "0.000", "Missing cashback should default to 0.000");

  // Test 5: groupSizeRequired is missing or 1
  const invalidGroupOffer = {
    signupCashbackKwd: "100.000",
    isGroupOffer: true,
    groupSizeRequired: 1, // Not a real group
  };
  assertEqual(getEffectiveSignupCashback(invalidGroupOffer), "100.000", "Group offer with size 1 should give full cashback");

  console.log("All tests completed!");
}

runTests();
