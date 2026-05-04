import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      // Brand
      appName: "Belamonda",
      tagline: "Beauty & Wellness Platform",

      // Auth
      login: "Login",
      logout: "Logout",
      phone: "Phone Number",
      email: "Email",
      password: "Password",
      otp: "OTP Code",
      sendOtp: "Send OTP",
      verifyOtp: "Verify",
      welcomeBack: "Welcome Back",
      loginSubtitle: "Sign in to your Belamonda account",
      demoAccess: "Demo Access",

      // Navigation
      dashboard: "Dashboard",
      home: "Home",
      offers: "Offers",
      myOffers: "My Offers",
      wallet: "Wallet",
      bookings: "Bookings",
      notifications: "Notifications",
      settings: "Settings",
      profile: "Profile",
      tasks: "Tasks",
      reports: "Reports",
      analytics: "Analytics",
      clinics: "Clinics",
      users: "Users",
      complaints: "Complaints",
      schedule: "Schedule",
      payments: "Payments",
      kyc: "KYC Verification",

      // Roles
      customer: "Customer",
      admin: "Admin",
      cs: "Customer Service",
      finance: "Finance",
      clinicStaff: "Clinic",

      // Products
      jamali: "Jamali Beauty Program",
      miniJamali: "Mini Jamali",
      nuomiClassic: "Nuomi Classic",
      nuomiPlus: "Nuomi Plus",
      sabaya: "Sabaya Membership",
      singleSession: "Single Session",
      threeSessions: "3 Sessions Package",

      // Wallet
      lockedBalance: "Locked Balance",
      unlockedBalance: "Available Balance",
      freeServices: "Free Services",
      totalEarned: "Total Earned",
      totalUsed: "Total Used",
      cashbackHistory: "Cashback History",
      transactionHistory: "Transaction History",

      // Dashboard KPIs
      activeCustomers: "Active Customers",
      todaySessions: "Today's Sessions",
      pendingPayments: "Pending Payments",
      pendingVerifications: "Pending Verifications",
      monthlyRevenue: "Monthly Revenue",
      cashbackIssued: "Cashback Issued",
      totalRevenue: "Total Revenue",

      // Status
      active: "Active",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      completed: "Completed",
      cancelled: "Cancelled",
      expired: "Expired",
      scheduled: "Scheduled",
      noShow: "No Show",
      inProgress: "In Progress",
      verified: "Verified",
      unverified: "Unverified",

      // Actions
      approve: "Approve",
      reject: "Reject",
      confirm: "Confirm",
      cancel: "Cancel",
      save: "Save",
      edit: "Edit",
      delete: "Delete",
      create: "Create",
      search: "Search",
      filter: "Filter",
      export: "Export",
      download: "Download",
      view: "View",
      viewAll: "View All",
      markComplete: "Mark Complete",
      bookSession: "Book Session",
      getOffer: "Get This Offer",

      // Language
      language: "Language",
      english: "English",
      arabic: "العربية",

      // Time
      today: "Today",
      thisWeek: "This Week",
      thisMonth: "This Month",
      thisYear: "This Year",

      // Finance
      revenue: "Revenue",
      payables: "Payables",
      liability: "Liability",
      revenueByClinic: "Revenue by Clinic",
      cashbackLiability: "Cashback Liability",
      pendingAmount: "Pending Amount",

      // Misc
      kwd: "KWD",
      noData: "No data available",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      welcome: "Welcome",
      todaysTasks: "Today's Tasks",
      recentActivity: "Recent Activity",
      quickActions: "Quick Actions",
    },
  },
  ar: {
    translation: {
      // Brand
      appName: "بيلاموندا",
      tagline: "منصة الجمال والعناية",

      // Auth
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      phone: "رقم الهاتف",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      otp: "رمز التحقق",
      sendOtp: "إرسال الرمز",
      verifyOtp: "تحقق",
      welcomeBack: "مرحبًا بعودتك",
      loginSubtitle: "سجل الدخول إلى حسابك في بيلاموندا",
      demoAccess: "وصول تجريبي",

      // Navigation
      dashboard: "لوحة التحكم",
      home: "الرئيسية",
      offers: "العروض",
      myOffers: "عروضي",
      wallet: "المحفظة",
      bookings: "الحجوزات",
      notifications: "الإشعارات",
      settings: "الإعدادات",
      profile: "الملف الشخصي",
      tasks: "المهام",
      reports: "التقارير",
      analytics: "التحليلات",
      clinics: "العيادات",
      users: "المستخدمين",
      complaints: "الشكاوى",
      schedule: "الجدول",
      payments: "المدفوعات",
      kyc: "التحقق من الهوية",

      // Roles
      customer: "عميلة",
      admin: "مدير النظام",
      cs: "خدمة العملاء",
      finance: "المالية",
      clinicStaff: "العيادة",

      // Products
      jamali: "برنامج جمالي",
      miniJamali: "ميني جمالي",
      nuomiClassic: "نعومي كلاسيك",
      nuomiPlus: "نعومي بلس",
      sabaya: "صبايا",
      singleSession: "جلسة واحدة",
      threeSessions: "٣ جلسات",

      // Wallet
      lockedBalance: "الرصيد المقفل",
      unlockedBalance: "الرصيد المتاح",
      freeServices: "خدمات مجانية",
      totalEarned: "إجمالي المكتسب",
      totalUsed: "إجمالي المستخدم",
      cashbackHistory: "سجل الكاش باك",
      transactionHistory: "سجل المعاملات",

      // Dashboard KPIs
      activeCustomers: "العملاء النشطين",
      todaySessions: "جلسات اليوم",
      pendingPayments: "مدفوعات معلقة",
      pendingVerifications: "تحققات معلقة",
      monthlyRevenue: "إيرادات الشهر",
      cashbackIssued: "كاش باك صادر",
      totalRevenue: "إجمالي الإيرادات",

      // Status
      active: "نشط",
      pending: "معلق",
      approved: "مقبول",
      rejected: "مرفوض",
      completed: "مكتمل",
      cancelled: "ملغي",
      expired: "منتهي",
      scheduled: "مجدول",
      noShow: "لم يحضر",
      inProgress: "قيد التنفيذ",
      verified: "موثق",
      unverified: "غير موثق",

      // Actions
      approve: "قبول",
      reject: "رفض",
      confirm: "تأكيد",
      cancel: "إلغاء",
      save: "حفظ",
      edit: "تعديل",
      delete: "حذف",
      create: "إنشاء",
      search: "بحث",
      filter: "تصفية",
      export: "تصدير",
      download: "تنزيل",
      view: "عرض",
      viewAll: "عرض الكل",
      markComplete: "إنهاء المهمة",
      bookSession: "حجز جلسة",
      getOffer: "احصلي على العرض",

      // Language
      language: "اللغة",
      english: "English",
      arabic: "العربية",

      // Time
      today: "اليوم",
      thisWeek: "هذا الأسبوع",
      thisMonth: "هذا الشهر",
      thisYear: "هذا العام",

      // Finance
      revenue: "الإيرادات",
      payables: "المستحقات",
      liability: "الالتزامات",
      revenueByClinic: "الإيرادات حسب العيادة",
      cashbackLiability: "التزامات الكاش باك",
      pendingAmount: "المبلغ المعلق",

      // Misc
      kwd: "د.ك",
      noData: "لا توجد بيانات",
      loading: "جاري التحميل...",
      error: "خطأ",
      success: "نجاح",
      welcome: "مرحبًا",
      todaysTasks: "مهام اليوم",
      recentActivity: "النشاط الأخير",
      quickActions: "إجراءات سريعة",
    },
  },
} as const;

const defaultLocale =
  (import.meta.env.VITE_DEFAULT_LOCALE as string | undefined) ?? "en";

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

const dir = i18n.language === "ar" ? "rtl" : "ltr";
document.documentElement.lang = i18n.language;
document.documentElement.dir = dir;

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
});

export default i18n;
