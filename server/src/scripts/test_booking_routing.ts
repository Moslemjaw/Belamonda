import mongoose from "mongoose";
import { config } from "dotenv";
import { join } from "path";
import { UserModel } from "../models/user.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { BookingRequestModel } from "../models/bookingRequest.model.js";
import { OfferModel } from "../models/offer.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { connectDB } from "../config/db.js";
import { findClinicStaffUserIds } from "../modules/scheduling/scheduling.router.js";

// A minimal reproduction of what happens in POST /me/request
import { api } from "./check_sessions_log.js"; // Just using the local env
config({ path: join(process.cwd(), ".env") });

async function runTest() {
  await connectDB();

  console.log("Creating test clinic...");
  const clinic = await ClinicModel.create({
    nameEn: "Test Clinic Routing",
    nameAr: "عيادة تجريبية للتوجيه",
    account: "test_routing_acc",
    passwordHash: "dummy",
    contactPhone: "+96500000000",
    contactEmail: "testrouting@example.com",
    active: true
  });
  console.log("Clinic ID:", clinic._id.toString());

  console.log("Creating test clinic staff...");
  const staff = await UserModel.create({
    phoneNumber: "+96599999999",
    displayName: "Test Staff",
    role: "clinicStaff",
    clinicId: clinic._id,
    isActive: true
  });
  console.log("Staff ID:", staff._id.toString());

  console.log("Creating test customer...");
  const customer = await UserModel.create({
    phoneNumber: "+96588888888",
    displayName: "Test Customer",
    role: "customer",
    isActive: true
  });
  console.log("Customer ID:", customer._id.toString());

  // Test findClinicStaffUserIds
  const staffIds = await findClinicStaffUserIds(clinic._id.toString());
  console.log("Found staff IDs for clinic:", staffIds);
  if (!staffIds.includes(staff._id.toString())) {
    console.error("FAILED to find staff ID!");
  } else {
    console.log("SUCCESS: Found staff ID!");
  }

  // Test the new booking route logic directly
  const bookingRoute = "clinic";
  const breq = await BookingRequestModel.create({
    userId: customer._id,
    clinicId: clinic._id,
    isStandalone: true,
    bookingRoute,
    status: "request_received",
    sessionPriceKwd: "10.000",
    hadCashback: false,
    membershipType: "none",
    preferredAt: new Date().toISOString(),
  });
  console.log("Created Booking Request with route:", breq.bookingRoute);

  // Check if findClinicStaffUserIds correctly maps
  // In `scheduling.router.ts`, it does:
  // const additionalNotifyIds = globalBookingRoute === "clinic" ? await findClinicStaffUserIds(breq.clinicId) : csIds;
  console.log("If routing to clinic, notifications will go to:", await findClinicStaffUserIds(breq.clinicId));

  // Cleanup
  await BookingRequestModel.findByIdAndDelete(breq._id);
  await UserModel.findByIdAndDelete(customer._id);
  await UserModel.findByIdAndDelete(staff._id);
  await ClinicModel.findByIdAndDelete(clinic._id);

  console.log("Cleanup done.");
  process.exit(0);
}

runTest().catch(console.error);
