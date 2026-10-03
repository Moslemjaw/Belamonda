// All state, data loading and handlers of the customer dashboard, in their original order.
import { useState, useEffect, useCallback } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../app/AuthContext";
import { useWallet, useMyOffers, useNotifications, useApi, useMyClinicChangeRequests, invalidateCache } from "../../../hooks/useApi";
import { apiFetch, API_BASE_URL, SITE_BASE_URL } from "../../../lib/api";
import QRCode from "qrcode";
import { clinics } from "../../../lib/treatments";
import { ApiOfferRow, ar } from "./shared";

export function useCustomerDashboard() {
  const queryParams = new URLSearchParams(window.location.search);
  const urlInviteCode = queryParams.get("inviteCode");
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { auth, logout, getAuthHeader } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [purchasesSubTab, setPurchasesSubTab] = useState<"packages" | "reservations">("packages");
  const [walletSubTab, setWalletSubTab] = useState<"cashback" | "history" | "card">("cashback");
  const [subscriptionSubTab, setSubscriptionSubTab] = useState<"status" | "invoices">("status");
  const [profileSubTab, setProfileSubTab] = useState<"settings" | "forms" | "notifications" | "share" | "complaints">("settings");
  const [showKyc, setShowKyc] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | undefined>(undefined);
  const [offerFilter, setOfferFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<{
    pkg: any;
    step: "confirm" | "creating" | "share" | "unlocked";
    userOfferId?: string;
    groupInviteCode?: string;
    membersJoined: number;
    membersNeeded: number;
    loading: boolean;
  } | null>(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const { data: walletData, loading: wLoading } = useWallet({ lazy: activeTab !== "overview" && activeTab !== "wallet" && activeTab !== "my-purchases" });
  const { data: offersData, refetch: refetchMyOffers } = useMyOffers({ lazy: activeTab !== "overview" && activeTab !== "my-purchases" && activeTab !== "store" });
  const { data: reservationsData, refetch: refetchReservations } = useApi<{ items: any[] }>(activeTab === "my-purchases" ? "/checkout/me/reservations" : null, { deps: [activeTab] });
  const { data: cardData, loading: cardLoading, error: cardError } = useApi<{ card: { displayName: string; memberSince: string | null; kycVerified: boolean; civilIdNumberMasked?: string | null; belmondoPlan?: string; belmondoProExpiresAt?: string | null; belmondoProPaymentType?: string; activeOffers: Array<{ offerId: string; offerName: string | null; activatedAt: string | null; expiresAt: string | null; sessionsUsed: number }>; activeSessionCount: number; recentSessions: Array<{ scheduledAt: string; status: string; completedAt: string | null }>; cashbackUnlockedKwd: string; cashbackLockedKwd: string; publicToken: string | undefined } }>(activeTab === "wallet" || activeTab === "overview" ? "/public/me/card" : null, { deps: [activeTab] });
  const { data: sessionsData, refetch: refetchMySessions } = useApi<{ items: any[] }>(activeTab === "my-purchases" || activeTab === "overview" ? "/scheduling/me/sessions" : null, { deps: [activeTab] });
  const { data: myComplaintsData, refetch: refetchMyComplaints } = useApi<{ items: any[] }>(activeTab === "profile" ? "/complaints/me" : null, { deps: [activeTab] });
  const { data: notifData } = useNotifications();
  const { data: chatsData, refetch: refetchChats } = useApi<{ items: any[] }>("/chat/conversations");
  const { data: clinicsPublic } = useApi<{ items: Array<{ id: string; nameEn: string; nameAr: string }> }>("/clinics");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories");
  const { data: availableFormsData, refetch: refetchAvailableForms } = useApi<{ items: Array<{ id: string; title: string }> }>(
    activeTab === "profile" || activeTab === "my-purchases" ? "/eforms/me/available" : null,
    { deps: [activeTab] }
  );
  const { data: myRequestsData, refetch: refetchMyRequests } = useApi<{
    items: Array<{
      id: string; status: string; offerId: string; clinicId: string;
      preferredAt?: string; sessionPaymentId?: string; sessionPriceKwd?: string;
      proposedAt?: string; confirmedAt?: string; rejectionReason?: string;
      conversationId?: string; scheduledSessionId?: string; createdAt: string;
    }>
  }>(activeTab === "my-purchases" ? "/scheduling/me/requests" : null, { deps: [activeTab] });
  const { data: myServerPayments } = useApi<{
    items: Array<{ id: string; amountKwd: string; purpose: string; status: string; method: string; createdAt: string; }>
  }>(activeTab === "wallet" ? "/payments/me" : null, { deps: [activeTab] });
  const unsignedForms = availableFormsData?.items ?? [];
  const [unsignedBannerDismissed, setUnsignedBannerDismissed] = useState(false);
  useEffect(() => {
    if (unsignedForms.length === 0) setUnsignedBannerDismissed(false);
  }, [unsignedForms.length]);
  useEffect(() => {
    if (activeTab !== "my-purchases" && activeTab !== "profile") return;
    const onVisible = () => { if (document.visibilityState === "visible") void refetchAvailableForms(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [activeTab, refetchAvailableForms]);
  const clinicsById = new Map((clinicsPublic?.items || []).map((c) => [c.id, c]));
  const categoryFilters = [
    { slug: "all", nameEn: "All", nameAr: "الكل" },
    ...((categoriesData?.items || []).filter((c) => c.slug !== "all"))
  ];
  const { data: homeCatalogData } = useApi<{ items: ApiOfferRow[] }>(
    activeTab === "overview" || activeTab === "store" ? "/offers" : null,
    { deps: [activeTab] }
  );
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [showChangeClinicModal, setShowChangeClinicModal] = useState<any>(null);
  const [newClinicSelection, setNewClinicSelection] = useState<string>("");
  const { data: standaloneOfferingsData } = useApi<{ items: Array<{
    id: string; clinicId: string; sessionTypeId: string;
    nameEn: string; nameAr: string; categorySlug: string;
    priceKwd: string; cashbackDeductionKwd: string;
    bookingMode: string; durationMinutes?: number;
  }> }>(activeTab === "store" || activeTab === "overview" ? "/session-types/offerings" : null, { deps: [activeTab] });
  const standaloneSessions = standaloneOfferingsData?.items || [];
  const urlOfferId = new URLSearchParams(window.location.search).get('offerId');
  useEffect(() => {
    if (urlOfferId) {
      const offer = homeCatalogData?.items?.find((o: any) => o.id === urlOfferId);
      if (offer) {
        // If they already have a pending_payment UserOffer for this, inject it!
        const existingUo = offersData?.items?.find((u: any) => u.offerId === offer.id && u.status === 'pending_payment');
        if (existingUo) {
          if (offer.isGroupOffer) {
            // Open group modal instead!
            setGroupModal({
              pkg: offer,
              step: "share",
              userOfferId: existingUo.id,
              groupInviteCode: existingUo.groupInviteCode,
              membersJoined: (existingUo.sharedWith || []).length,
              membersNeeded: (offer.groupSizeRequired || 2) - 1,
              loading: false,
            });
          } else {
             setCheckoutPkg({ ...offer, userOfferId: existingUo.id });
          }
        } else {
          // Normal flow
          if (offer.isGroupOffer) {
             setGroupModal({
               pkg: offer,
               step: "confirm",
               membersJoined: 0,
               membersNeeded: (offer.groupSizeRequired || 2) - 1,
               loading: false,
             });
          } else {
             setCheckoutPkg(offer);
          }
        }
        // Clear it from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [urlOfferId, homeCatalogData, offersData?.items]);
  const dynamicTreatments = standaloneSessions.reduce((acc: any[], s: any) => {
    const priceKwd = parseFloat(s.priceKwd) || 0;
    const cashbackKwd = parseFloat(s.cashbackDeductionKwd) || 0;
    let existing = acc.find((x: any) => x.id === s.sessionTypeId);
    if (!existing) {
      existing = {
        id: s.sessionTypeId,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        category: s.categorySlug,
        priceKwd,
        cashbackKwd,
        discountPct: 0,
        clinicIds: [] as string[],
        /** Each clinic can charge a different price for the same session type */
        offeringsByClinic: {} as Record<string, { priceKwd: number; cashbackKwd: number }>
      };
      acc.push(existing);
    }
    if (s.clinicId) {
      if (!existing.clinicIds.includes(s.clinicId)) {
        existing.clinicIds.push(s.clinicId);
      }
      existing.offeringsByClinic[s.clinicId] = { priceKwd, cashbackKwd };
    }
    return acc;
  }, []);
  const sessions = sessionsData?.items || [];
  const [localLedger, setLocalLedger] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bel_financial_ledger_v1') || '[]'); } catch { return []; }
  });
  const { data: myClinicChangesData, refetch: refetchClinicChanges } = useMyClinicChangeRequests();
  const myClinicChanges = myClinicChangesData?.items || [];
  useEffect(() => {
    // Only re-render when the stored ledger actually changes (this polls every second).
    let lastRaw: string | null = null;
    const sync = () => {
       try { 
          const raw = localStorage.getItem('bel_financial_ledger_v1') || '[]';
          if (raw === lastRaw) return;
          lastRaw = raw;
          setLocalLedger(JSON.parse(raw));
       } catch {}
    };
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000);
    return () => { window.removeEventListener('storage', sync); clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (!urlInviteCode) return;
    apiFetch(`/checkout/group-invite/${encodeURIComponent(urlInviteCode)}`, { headers: getAuthHeader() })
      .then((data: any) => {
        if (data.isGroupOffer) {
          apiFetch("/commerce/me/offers/join", {
            method: "POST",
            headers: getAuthHeader(),
            body: JSON.stringify({ inviteCode: urlInviteCode })
          }).then(() => {
            invalidateCache("/commerce/me/offers");
            refetchMyOffers(true);
            window.history.replaceState({}, document.title, window.location.pathname);
            setSysAlert(ar() ? "تم الانضمام إلى المجموعة بنجاح! يمكنك الآن تتبع تقدم المجموعة هنا." : "Successfully joined the group! You can track its progress here.");
            setActiveTab("my-purchases");
            setPurchasesSubTab("packages");
          }).catch(e => {
            setSysAlert(e.message || (ar() ? "فشل الانضمام إلى المجموعة" : "Failed to join group"));
            window.history.replaceState({}, document.title, window.location.pathname);
          });
        } else {
          setPendingInviteCode(urlInviteCode);
          setCheckoutPkg({ ...data, id: data.offerId });
          setActiveTab("store");
        }
      })
      .catch(() => {});
  }, [urlInviteCode, ar]);
  const [sysAlert, setSysAlert] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<any>(null);
  const [showBookingPromptModal, setShowBookingPromptModal] = useState<any>(null);
  const [showClinicHandlesPrompt, setShowClinicHandlesPrompt] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState("full");
  const [installments, setInstallments] = useState(2);
  const [bookFirstSession, setBookFirstSession] = useState(true);
  const [selectedFirstSession, setSelectedFirstSession] = useState<string>("");
  const [selectedFirstClinic, setSelectedFirstClinic] = useState<string>("");
  /** Preferred clinic per session type on "Book a Session" cards (drives per-clinic price) */
  const [sessionClinicByTreatmentId, setSessionClinicByTreatmentId] = useState<Record<string, string>>({});
  const [walletActionLoading, setWalletActionLoading] = useState<"apple" | "google" | null>(null);
  const [complaintForm, setComplaintForm] = useState({ category: "other", subject: "", description: "" });
  useEffect(() => {
     if (selectedPkg) {
        setBookFirstSession(true);
        setSelectedFirstSession("");
        setSelectedFirstClinic("");
        if (selectedPkg.clinicId) {
          setSelectedClinic(selectedPkg.clinicId);
        }
     }
  }, [selectedPkg]);
  const [kycStatus, setKycStatus] = useState<string>("checking");
  const requireKyc = () => {
    if (kycStatus === "unverified" || kycStatus === "pending") {
      setShowKyc(true);
      return false;
    }
    return true;
  };
  const attemptCheckout = (pkg: any) => {
    if (!requireKyc()) return;
    setCheckoutPkg(pkg);
  };
  const { data: myProfile, refetch: refetchProfile } = useApi<{ user: { username?: string; email?: string; phone?: string; fullName?: string; gender?: string } }>("/users/me");
  const displayName = myProfile?.user?.fullName || myProfile?.user?.username || cardData?.card?.displayName || "—";
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    name: "",
    phone: "",
    email: ""
  });
  useEffect(() => {
    if (myProfile?.user) {
      setProfileForm({
        username: myProfile.user.username || "",
        name: myProfile.user.fullName || "",
        phone: myProfile.user.phone || "",
        email: myProfile.user.email || ""
      });
    }
  }, [myProfile]);
  useEffect(() => {
    const check = async () => {
      try {
        const data = await apiFetch("/public/me/card", { headers: getAuthHeader() }) as any;
        setKycStatus(data.card?.kycStatus || "unverified");
      } catch { setKycStatus("unverified"); }
    };
    if (!showKyc) check();
  }, [getAuthHeader, showKyc]);
  const wallet = walletData?.wallet;
  const offers = offersData?.items || [];
  const unreadNotifs = (notifData?.inbox || []).filter(n => !n.read).length;
  const unreadChats = (chatsData?.items || []).reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
  const showWalletStatus = useCallback((message: string) => {
    setSysAlert(message);
    setTimeout(() => setSysAlert(null), 6000);
  }, []);
  // ── Canvas-based card image generation (fallback when wallet services aren't configured) ──
  const generateCardImage = useCallback(async (member: {
    displayName: string;
    memberSince: string | null;
    kycVerified: boolean;
    publicToken?: string;
    verifyUrl?: string;
  }): Promise<Blob> => {
    const SCALE = 2; // retina
    const W = 375 * SCALE;
    const H = Math.round(W / 1.586);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // ── Helper: rounded rectangle path ──
    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };

    // ── Card background gradient ──
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.45, "#831843");
    grad.addColorStop(1, "#be185d");
    roundedRect(0, 0, W, H, 28 * SCALE);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.clip(); // clip to rounded rect

    // ── Decorative glow circles ──
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.2, W * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.15, H * 0.8, W * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── "ACCOUNT CARD" title ──
    const pad = 32 * SCALE;
    ctx.font = `bold ${11 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textBaseline = "top";
    ctx.letterSpacing = `${3 * SCALE}px`;
    ctx.fillText(ar() ? "بطاقة الحساب" : "ACCOUNT CARD", pad, pad);
    ctx.letterSpacing = "0px";

    // ── QR Code (top-right) ──
    if (member.publicToken) {
      const qrUrl = member.verifyUrl || `${SITE_BASE_URL}/verify/${member.publicToken}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 56 * SCALE,
          margin: 1,
          errorCorrectionLevel: "H",
          color: { dark: "#111111", light: "#ffffff" },
        });
        const qrImg = new Image();
        await new Promise<void>((resolve, reject) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = reject;
          qrImg.src = qrDataUrl;
        });
        // White rounded background behind QR
        const qrSize = 56 * SCALE;
        const qrPad = 8 * SCALE;
        const qrX = W - pad - qrSize - qrPad * 2;
        const qrY = pad - 4 * SCALE;
        ctx.fillStyle = "#ffffff";
        roundedRect(qrX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 10 * SCALE);
        ctx.fill();
        ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrSize, qrSize);
      } catch { /* QR generation failed, skip */ }
    }

    // ── Member name ──
    ctx.font = `800 ${24 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "bottom";
    ctx.fillText(member.displayName, pad, H - 72 * SCALE);

    // (Member Since removed per request)

    // ── Verification badge ──
    ctx.font = `bold ${9 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    if (member.kycVerified) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      roundedRect(pad, H - 42 * SCALE, 140 * SCALE, 22 * SCALE, 6 * SCALE);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText("✓  Identity Verified", pad + 10 * SCALE, H - 31 * SCALE);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundedRect(pad, H - 42 * SCALE, 150 * SCALE, 22 * SCALE, 6 * SCALE);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textBaseline = "middle";
      ctx.fillText("○  Verification Pending", pad + 10 * SCALE, H - 31 * SCALE);
    }

    // ── BELAMONDA logo (bottom-right) ──
    try {
      const logoImg = new Image();
      const { default: logoSrc } = await import("../../../assets/belamondo-logo.png");
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = reject;
        logoImg.src = logoSrc;
      });
      const logoH = 30 * SCALE;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(logoImg, W - pad - logoW, H - pad - logoH, logoW, logoH);
      ctx.globalAlpha = 1;
    } catch {
      // Fallback to text if logo fails
      ctx.font = `800 ${13 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.letterSpacing = `${3 * SCALE}px`;
      ctx.fillText("BELAMONDA", W - pad, H - pad);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "left";
    }

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/png"
      );
    });
  }, []);
  // ── Share or download a card image blob ──
  const shareOrDownloadCard = useCallback(async (blob: Blob) => {
    const file = new File([blob], "belamonda-membership.png", { type: "image/png" });
    // Try Web Share API first (native share sheet on iOS / Android)
    if (navigator.share && typeof navigator.canShare === "function") {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Belamonda Membership Card",
            text: ar() ? "بطاقة عضويتي في بيلاموندو" : "My Belamonda membership card",
            files: [file],
          });
          showWalletStatus(ar() ? "✅ تمت مشاركة البطاقة بنجاح." : "✅ Card shared successfully.");
          return;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled share
      }
    }
    // Fallback: download the PNG
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "belamonda-membership.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showWalletStatus(
      ar()
        ? "✅ تم حفظ صورة البطاقة. يمكنك إضافتها يدوياً إلى محفظتك."
        : "✅ Card image saved. You can add it to your wallet from your photos."
    );
  }, [showWalletStatus]);
  const handleWalletDownload = useCallback(async (provider: "apple" | "google") => {
    setWalletActionLoading(provider);
    try {
      const origin = encodeURIComponent(SITE_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/public/me/wallet/${provider}?origin=${origin}`, {
        headers: getAuthHeader(),
      });

      const contentType = response.headers.get("content-type") || "";

      // ── Apple Wallet: .pkpass binary download ──
      if (provider === "apple" && response.ok && contentType.includes("application/vnd.apple.pkpass")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "belamonda-membership.pkpass";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showWalletStatus(ar() ? "✅ تم تحميل بطاقة Apple Wallet." : "✅ Apple Wallet pass downloaded.");
        return;
      }

      // ── JSON response (success or error) ──
      const data = await response.json();

      // Google Wallet: save URL ready
      if (provider === "google" && data.saveUrl) {
        window.open(data.saveUrl, "_blank", "noopener,noreferrer");
        showWalletStatus(ar() ? "✅ تم فتح محفظة جوجل." : "✅ Google Wallet opened.");
        return;
      }

      // ── Not configured: generate card image as fallback ──
      // Use memberData from server response, or fall back to cardData from the /me/card hook
      const member = data.memberData || (cardData?.card ? {
        displayName: cardData.card.displayName,
        memberSince: cardData.card.memberSince
          ? fmtDate(cardData.card.memberSince)
          : null,
        kycVerified: cardData.card.kycVerified,
        publicToken: cardData.card.publicToken,
      } : null);

      if (member) {
        const blob = await generateCardImage(member);
        await shareOrDownloadCard(blob);
        return;
      }

      // No member data available at all
      showWalletStatus(ar() ? "❌ بيانات البطاقة غير متوفرة." : "❌ Card data not available.");
    } catch {
      // Server error — try generating card image directly from local cardData
      try {
        if (cardData?.card) {
          const member = {
            displayName: cardData.card.displayName,
            memberSince: cardData.card.memberSince
              ? fmtDate(cardData.card.memberSince)
              : null,
            kycVerified: cardData.card.kycVerified,
            publicToken: cardData.card.publicToken,
          };
          const blob = await generateCardImage(member);
          await shareOrDownloadCard(blob);
          return;
        }
      } catch { /* fallback also failed */ }
      showWalletStatus(ar() ? "❌ تعذر تجهيز بطاقة المحفظة." : "❌ Unable to generate wallet card.");
    } finally {
      setWalletActionLoading(null);
    }
  }, [getAuthHeader, showWalletStatus, generateCardImage, shareOrDownloadCard, cardData]);
  return { queryParams, urlInviteCode, navigate, t, auth, logout, getAuthHeader, activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, purchasesSubTab, setPurchasesSubTab, walletSubTab, setWalletSubTab, subscriptionSubTab, setSubscriptionSubTab, profileSubTab, setProfileSubTab, showKyc, setShowKyc, chatConvId, setChatConvId, offerFilter, setOfferFilter, sessionFilter, setSessionFilter, selectedPkg, setSelectedPkg, checkoutPkg, setCheckoutPkg, pendingInviteCode, setPendingInviteCode, copiedCode, setCopiedCode, groupModal, setGroupModal, isBookingSubmitting, setIsBookingSubmitting, walletData, wLoading, offersData, refetchMyOffers, reservationsData, refetchReservations, cardData, cardLoading, cardError, sessionsData, refetchMySessions, myComplaintsData, refetchMyComplaints, notifData, chatsData, refetchChats, clinicsPublic, categoriesData, availableFormsData, refetchAvailableForms, myRequestsData, refetchMyRequests, myServerPayments, unsignedForms, unsignedBannerDismissed, setUnsignedBannerDismissed, clinicsById, categoryFilters, homeCatalogData, selectedClinic, setSelectedClinic, showChangeClinicModal, setShowChangeClinicModal, newClinicSelection, setNewClinicSelection, standaloneOfferingsData, standaloneSessions, urlOfferId, dynamicTreatments, sessions, localLedger, setLocalLedger, myClinicChangesData, refetchClinicChanges, myClinicChanges, sysAlert, setSysAlert, showBookingModal, setShowBookingModal, showBookingPromptModal, setShowBookingPromptModal, showClinicHandlesPrompt, setShowClinicHandlesPrompt, paymentOption, setPaymentOption, installments, setInstallments, bookFirstSession, setBookFirstSession, selectedFirstSession, setSelectedFirstSession, selectedFirstClinic, setSelectedFirstClinic, sessionClinicByTreatmentId, setSessionClinicByTreatmentId, walletActionLoading, setWalletActionLoading, complaintForm, setComplaintForm, kycStatus, setKycStatus, requireKyc, attemptCheckout, myProfile, refetchProfile, displayName, isEditingProfile, setIsEditingProfile, profileForm, setProfileForm, wallet, offers, unreadNotifs, unreadChats, showWalletStatus, generateCardImage, shareOrDownloadCard, handleWalletDownload };
}

export type CustomerDashboardState = ReturnType<typeof useCustomerDashboard>;
