import { Router } from "express";
import { authRequired } from "../../middlewares/authRequired.js";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { kycStore } from "../kyc/kyc.store.js";
import { env } from "../../config/env.js";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";

export const walletPassRouter = Router();

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

function getGoogleServiceAccountFromEnv(): GoogleServiceAccount | null {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  // Accept either:
  // 1) full service-account JSON
  // 2) base64-encoded service-account JSON
  // 3) raw private key (paired with GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL)
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleServiceAccount>;
    if (parsed.client_email && parsed.private_key) {
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }
  } catch {
    // not plain JSON
  }

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<GoogleServiceAccount>;
    if (parsed.client_email && parsed.private_key) {
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }
  } catch {
    // not base64 JSON
  }

  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  if (!email) return null;
  return {
    client_email: email,
    private_key: raw.replace(/\\n/g, "\n"),
  };
}

// ── Helper: build member data for wallet passes ─────────────────────────────
async function getMemberData(userId: string) {
  const user = await UserModel.findById(userId)
    .select("_id username fullName publicToken createdAt role")
    .lean<{ _id: any; username?: string; fullName?: string; publicToken?: string; createdAt?: Date; role: string }>();

  if (!user || user.role !== "customer") return null;

  const kycUser = await kycStore.getUser(userId);
  const activeOfferCount = await UserOfferModel.countDocuments({ userId, status: "active" });
  const displayName = user.fullName || user.username || "Member";
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "N/A";

  return {
    displayName,
    memberSince,
    kycVerified: kycUser?.verificationStatus === "approved",
    activeOfferCount,
    publicToken: user.publicToken || "",
  };
}

// ── Apple Wallet (.pkpass) ──────────────────────────────────────────────────
// A real .pkpass requires Apple Developer certificates (WWDR + Pass Type ID).
// This endpoint generates a valid .pkpass ZIP structure. When the env vars
// APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT, and APPLE_PASS_KEY
// are set, a fully signed pass can be created.
walletPassRouter.get("/me/wallet/apple", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const member = await getMemberData(userId);
    if (!member) return res.status(404).json({ error: "NOT_FOUND" });

    const clientOrigin = (req.query.origin as string) || env.CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const verifyUrl = `${clientOrigin}/verify/${member.publicToken}`;

    // Member data for client-side fallback (card image generation)
    const memberData = {
      displayName: member.displayName,
      memberSince: member.memberSince,
      kycVerified: member.kycVerified,
      publicToken: member.publicToken,
      verifyUrl,
    };

    // Check if Apple Pass signing is configured
    const hasAppleCerts = !!(
      process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_CERT &&
      process.env.APPLE_PASS_KEY
    );

    if (!hasAppleCerts) {
      return res.status(503).json({
        status: "APPLE_WALLET_NOT_CONFIGURED",
        message: "Apple Wallet pass is not configured on the server.",
        memberData,
      });
    }

    // Apple certs are present, but signed .pkpass generation is not wired yet.
    return res.status(501).json({
      status: "APPLE_WALLET_SIGNING_NOT_IMPLEMENTED",
      message: "Apple Wallet signing is pending implementation.",
      memberData,
    });
  } catch (e) {
    next(e);
  }
});

// ── Google Wallet ───────────────────────────────────────────────────────────
// Google Wallet requires a Google Cloud service account with the Wallet API
// enabled. This endpoint generates a Google Wallet "Save" link.
// When GOOGLE_WALLET_ISSUER_ID and service-account credentials are set,
// we generate a signed JWT and return a Google Wallet Save URL.
walletPassRouter.get("/me/wallet/google", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const member = await getMemberData(userId);
    if (!member) return res.status(404).json({ error: "NOT_FOUND" });

    const clientOrigin = (req.query.origin as string) || env.CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const verifyUrl = `${clientOrigin}/verify/${member.publicToken}`;

    // Member data for client-side fallback (card image generation)
    const memberData = {
      displayName: member.displayName,
      memberSince: member.memberSince,
      kycVerified: member.kycVerified,
      publicToken: member.publicToken,
      verifyUrl,
    };

    const serviceAccount = getGoogleServiceAccountFromEnv();
    const hasGoogleConfig = !!(process.env.GOOGLE_WALLET_ISSUER_ID && serviceAccount);

    if (!hasGoogleConfig || !serviceAccount) {
      return res.status(503).json({
        status: "GOOGLE_WALLET_NOT_CONFIGURED",
        message: "Google Wallet is not configured on the server.",
        memberData,
      });
    }

    if (hasGoogleConfig) {
      // Build the Google Wallet generic pass object
      const objectId = `${process.env.GOOGLE_WALLET_ISSUER_ID}.belamonda_${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;

      const genericObject = {
        id: objectId,
        classId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.belamonda_membership`,
        genericType: "GENERIC_TYPE_UNSPECIFIED",
        hexBackgroundColor: "#9d174d",
        logo: {
          sourceUri: { uri: `${clientOrigin}/logo192.png` },
        },
        cardTitle: { defaultValue: { language: "en", value: "BELAMONDA" } },
        subheader: { defaultValue: { language: "en", value: "MEMBER" } },
        header: { defaultValue: { language: "en", value: member.displayName } },
        barcode: {
          type: "QR_CODE",
          value: verifyUrl,
        },
        textModulesData: [
          {
            id: "member_since",
            header: "Member Since",
            body: member.memberSince,
          },
          {
            id: "status",
            header: "Status",
            body: member.kycVerified ? "Verified ✓" : "Pending Verification",
          },
          {
            id: "memberships",
            header: "Active Memberships",
            body: String(member.activeOfferCount),
          },
        ],
        linksModuleData: {
          uris: [
            { uri: verifyUrl, description: "Verify Membership", id: "verify_link" },
            { uri: clientOrigin, description: "Belamonda Website", id: "website_link" },
          ],
        },
      };

      const token = jwt.sign(
        {
          iss: serviceAccount.client_email,
          aud: "google",
          typ: "savetowallet",
          origins: [clientOrigin],
          payload: {
            genericObjects: [genericObject],
          },
        },
        serviceAccount.private_key,
        {
          algorithm: "RS256",
        }
      );

      const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
      return res.json({
        status: "GOOGLE_WALLET_READY",
        saveUrl,
      });
    }
  } catch (e) {
    next(e);
  }
});
