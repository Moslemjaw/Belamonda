export const treatmentCategories = [
  { id: "laser", icon: "💡", nameEn: "Laser Services", nameAr: "خدمات الليزر" },
  { id: "injectables", icon: "💉", nameEn: "Injectables", nameAr: "الحقن" },
  { id: "skincare", icon: "🧴", nameEn: "Skin Care", nameAr: "العناية بالبشرة" },
  { id: "beauty", icon: "💋", nameEn: "Beauty Enhancements", nameAr: "التحسينات التجميلية" },
  { id: "body", icon: "🧖‍♀️", nameEn: "Body & Slimming", nameAr: "الجسم والتخسيس" },
  { id: "dental", icon: "🦷", nameEn: "Dental Services", nameAr: "خدمات الأسنان" },
  { id: "medical", icon: "🧘‍♀️", nameEn: "Medical & Meditation", nameAr: "الطب والتأمل" }
];

export type Clinic = { id: string; nameEn: string; nameAr: string };

export const clinics: Clinic[] = [
  { id: "salmiya", nameEn: "Belamonda Salmiya", nameAr: "بيلاموندا السالمية" },
  { id: "hawally", nameEn: "Belamonda Hawally", nameAr: "بيلاموندا حولي" },
  { id: "jabriya", nameEn: "Belamonda Jabriya", nameAr: "بيلاموندا الجابرية" },
  { id: "farwaniya", nameEn: "Belamonda Farwaniya", nameAr: "بيلاموندا الفروانية" },
];

export type Treatment = {
  id: string;
  category: string;
  nameEn: string;
  nameAr: string;
  priceKwd: number;
  discountPct: number;
  cashbackKwd: number;
  clinicIds: string[]; // which clinics offer this — empty = none yet
};

export const allTreatments: Treatment[] = [
  // ── Injectables ──
  { id: "filler_italian", category: "injectables", nameEn: "Filler (Italian)", nameAr: "فيلر إيطالي", priceKwd: 85, discountPct: 15, cashbackKwd: 5, clinicIds: ["salmiya", "hawally"] },
  { id: "filler_princess", category: "injectables", nameEn: "Filler (Princess)", nameAr: "فيلر برنسس", priceKwd: 75, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya", "jabriya"] },
  { id: "filler_tosyal", category: "injectables", nameEn: "Filler (Tosyal)", nameAr: "فيلر توسيال", priceKwd: 80, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya"] },
  { id: "filler_texas", category: "injectables", nameEn: "Cheek Filler & Texas (Jawline Contouring)", nameAr: "فيلر الخدود وتكساس", priceKwd: 120, discountPct: 20, cashbackKwd: 8, clinicIds: ["salmiya", "hawally"] },
  { id: "filler_body", category: "injectables", nameEn: "Body Filler (10 ml)", nameAr: "فيلر للجسم (10 مل)", priceKwd: 250, discountPct: 10, cashbackKwd: 10, clinicIds: ["salmiya"] },
  { id: "filler_dissolving", category: "injectables", nameEn: "Filler Dissolving", nameAr: "تذويب الفيلر", priceKwd: 45, discountPct: 0, cashbackKwd: 0, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "botox", category: "injectables", nameEn: "Botox (One Area / Full Face / Hyperhidrosis)", nameAr: "بوتوكس (منطقة / كامل الوجه / فرط التعرق)", priceKwd: 90, discountPct: 15, cashbackKwd: 5, clinicIds: ["salmiya", "hawally"] },
  { id: "baby_face", category: "injectables", nameEn: "Baby Face Injection", nameAr: "إبرة بيبي فيس", priceKwd: 65, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya", "jabriya"] },
  { id: "asala_olidia", category: "injectables", nameEn: "Asala Injection (Olidia)", nameAr: "إبرة أصالة (أوليديا)", priceKwd: 55, discountPct: 10, cashbackKwd: 2, clinicIds: ["hawally"] },
  { id: "glow_inj", category: "injectables", nameEn: "Glow Injection", nameAr: "إبرة النضارة (جلو)", priceKwd: 50, discountPct: 20, cashbackKwd: 5, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "amber_inj", category: "injectables", nameEn: "Amber Injection", nameAr: "إبرة العنبر", priceKwd: 55, discountPct: 15, cashbackKwd: 3, clinicIds: ["salmiya"] },
  { id: "salmon_inj", category: "injectables", nameEn: "Salmon Injection", nameAr: "إبرة السلمون", priceKwd: 60, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya", "hawally"] },
  { id: "filter_inj", category: "injectables", nameEn: "Filter Injection", nameAr: "إبرة الفلتر", priceKwd: 45, discountPct: 10, cashbackKwd: 2, clinicIds: ["jabriya"] },
  { id: "undereye_inj", category: "injectables", nameEn: "Under-Eye Brightening Injections", nameAr: "إبر تفتيح تحت العين", priceKwd: 70, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya", "hawally"] },

  // ── Skin Care ──
  { id: "hydrafacial", category: "skincare", nameEn: "Hydrafacial", nameAr: "هايدرا فيشل", priceKwd: 35, discountPct: 20, cashbackKwd: 3, clinicIds: ["salmiya", "hawally", "jabriya", "farwaniya"] },
  { id: "deep_cleansing", category: "skincare", nameEn: "Deep Facial Cleansing", nameAr: "تنظيف بشره عميق", priceKwd: 25, discountPct: 10, cashbackKwd: 1, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "dermaplaning", category: "skincare", nameEn: "Dermaplaning", nameAr: "ديرما بلانينج", priceKwd: 30, discountPct: 15, cashbackKwd: 2, clinicIds: ["salmiya", "hawally"] },
  { id: "facial_bleaching", category: "skincare", nameEn: "Facial Bleaching (Face / Eyebrows)", nameAr: "تشقير الوجه والحواجب", priceKwd: 15, discountPct: 0, cashbackKwd: 0, clinicIds: ["salmiya", "hawally", "jabriya", "farwaniya"] },
  { id: "green_peel", category: "skincare", nameEn: "Green Peel (Facial Peeling)", nameAr: "التقشير الأخضر", priceKwd: 40, discountPct: 10, cashbackKwd: 2, clinicIds: ["salmiya"] },
  { id: "carbon_treatment", category: "skincare", nameEn: "Carbon Treatment (Pigmentation)", nameAr: "التقشير الكربوني", priceKwd: 35, discountPct: 15, cashbackKwd: 2, clinicIds: ["salmiya", "hawally"] },
  { id: "dermapen", category: "skincare", nameEn: "Dermapen (Microneedling)", nameAr: "ديرمابن", priceKwd: 45, discountPct: 20, cashbackKwd: 4, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "led_therapy", category: "skincare", nameEn: "LED Therapy", nameAr: "علاج الإضاءة LED", priceKwd: 20, discountPct: 10, cashbackKwd: 1, clinicIds: ["salmiya", "jabriya"] },
  { id: "onda", category: "skincare", nameEn: "ONDA Device (Double Chin)", nameAr: "جهاز أوندا (اللغلوغ)", priceKwd: 60, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya"] },
  { id: "exosome", category: "skincare", nameEn: "Exosome Therapy", nameAr: "علاج الإكسوسوم", priceKwd: 95, discountPct: 10, cashbackKwd: 5, clinicIds: [] },

  // ── Beauty ──
  { id: "face_prp", category: "beauty", nameEn: "Face Plasma (PRP)", nameAr: "بلازما الوجه", priceKwd: 40, discountPct: 15, cashbackKwd: 3, clinicIds: ["salmiya", "hawally"] },
  { id: "hair_prp", category: "beauty", nameEn: "Hair Plasma (PRP)", nameAr: "بلازما الشعر", priceKwd: 40, discountPct: 15, cashbackKwd: 3, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "prp_dermapen", category: "beauty", nameEn: "Plasma + Dermapen Combo", nameAr: "بلازما + ديرمابن", priceKwd: 70, discountPct: 25, cashbackKwd: 8, clinicIds: ["salmiya"] },
  { id: "hair_meso", category: "beauty", nameEn: "Hair Mesotherapy (Biotin)", nameAr: "ميزوثيرابي للشعر (بيوتين)", priceKwd: 35, discountPct: 10, cashbackKwd: 2, clinicIds: ["salmiya", "hawally"] },
  { id: "lip_tinting", category: "beauty", nameEn: "Lip Tinting", nameAr: "توريد الشفايف", priceKwd: 55, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya", "jabriya"] },
  { id: "lip_blushing", category: "beauty", nameEn: "Lip Blushing", nameAr: "كونتور الشفايف", priceKwd: 60, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya"] },
  { id: "undereye_beauty", category: "beauty", nameEn: "Under-Eye Treatments", nameAr: "تجميل تحت العين", priceKwd: 50, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya", "hawally"] },

  // ── Body ──
  { id: "body_whitening", category: "body", nameEn: "Body Whitening", nameAr: "تبييض الجسم", priceKwd: 50, discountPct: 15, cashbackKwd: 3, clinicIds: ["salmiya", "hawally"] },
  { id: "body_peeling", category: "body", nameEn: "Body Peeling (Elbows & Knees)", nameAr: "تقشير الجسم (الكوع والركبة)", priceKwd: 25, discountPct: 10, cashbackKwd: 1, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "body_sculpting", category: "body", nameEn: "Body Sculpting / Tightening Sessions", nameAr: "نحت وشد الجسم", priceKwd: 80, discountPct: 20, cashbackKwd: 6, clinicIds: ["salmiya"] },
  { id: "body_slimming", category: "body", nameEn: "Body Slimming / Fat Reduction", nameAr: "تخسيس الجسم", priceKwd: 75, discountPct: 20, cashbackKwd: 5, clinicIds: ["salmiya", "hawally"] },
  { id: "stretch_marks", category: "body", nameEn: "Stretch Mark Treatment", nameAr: "علاج علامات التمدد", priceKwd: 55, discountPct: 15, cashbackKwd: 3, clinicIds: ["salmiya"] },
  { id: "skin_repair", category: "body", nameEn: "Skin Repair Treatment (Cracks)", nameAr: "إصلاح تشققات الجلد", priceKwd: 45, discountPct: 10, cashbackKwd: 2, clinicIds: [] },
  { id: "double_chin_fat", category: "body", nameEn: "Double Chin Fat Dissolving", nameAr: "إذابة دهون اللغلوغ", priceKwd: 65, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya", "hawally"] },
  { id: "facial_slimming", category: "body", nameEn: "Facial Slimming", nameAr: "تنحيف الوجه", priceKwd: 50, discountPct: 10, cashbackKwd: 2, clinicIds: ["salmiya"] },
  { id: "fat_dissolving_inj", category: "body", nameEn: "Fat Dissolving Injections (Packages)", nameAr: "إبر إذابة الدهون", priceKwd: 120, discountPct: 25, cashbackKwd: 10, clinicIds: ["salmiya"] },

  // ── Laser ──
  { id: "fractional", category: "laser", nameEn: "Fractional Laser", nameAr: "فراكشنال ليزر", priceKwd: 55, discountPct: 15, cashbackKwd: 4, clinicIds: ["salmiya", "hawally"] },
  { id: "pico", category: "laser", nameEn: "Pico Laser", nameAr: "بيكو ليزر", priceKwd: 65, discountPct: 10, cashbackKwd: 3, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "tattoo_removal", category: "laser", nameEn: "Tattoo Removal (Body & Eyebrow)", nameAr: "إزالة التاتو (الجسم والحواجب)", priceKwd: 80, discountPct: 20, cashbackKwd: 6, clinicIds: ["salmiya"] },
  { id: "skin_tags", category: "laser", nameEn: "Skin Tags Removal", nameAr: "إزالة الزوائد الجلدية", priceKwd: 30, discountPct: 0, cashbackKwd: 0, clinicIds: ["salmiya", "hawally", "jabriya"] },
  { id: "white_hair", category: "laser", nameEn: "White Hair Removal", nameAr: "إزالة الشعر الأبيض", priceKwd: 40, discountPct: 10, cashbackKwd: 2, clinicIds: ["salmiya", "hawally"] },
  { id: "full_body_laser", category: "laser", nameEn: "Full Body Laser Hair Removal", nameAr: "ليزر إزالة الشعر كامل الجسم", priceKwd: 150, discountPct: 25, cashbackKwd: 15, clinicIds: ["salmiya", "hawally"] },

  // ── Dental ──
  { id: "dental_consult", category: "dental", nameEn: "Consultation", nameAr: "استشارة", priceKwd: 10, discountPct: 0, cashbackKwd: 0, clinicIds: ["farwaniya"] },
  { id: "xray", category: "dental", nameEn: "X-Ray", nameAr: "أشعة", priceKwd: 15, discountPct: 0, cashbackKwd: 0, clinicIds: ["farwaniya"] },
  { id: "teeth_cleaning", category: "dental", nameEn: "Teeth Cleaning / Gum Cleaning", nameAr: "تنظيف أسنان ولثة", priceKwd: 20, discountPct: 10, cashbackKwd: 1, clinicIds: ["farwaniya"] },
  { id: "fillings", category: "dental", nameEn: "Fillings", nameAr: "حشوات", priceKwd: 25, discountPct: 10, cashbackKwd: 1, clinicIds: ["farwaniya"] },
  { id: "root_canal", category: "dental", nameEn: "Root Canal (All Types)", nameAr: "علاج عصب", priceKwd: 80, discountPct: 15, cashbackKwd: 5, clinicIds: ["farwaniya"] },
  { id: "extraction", category: "dental", nameEn: "Tooth Extraction (Simple & Surgical)", nameAr: "خلع الأسنان", priceKwd: 35, discountPct: 10, cashbackKwd: 2, clinicIds: ["farwaniya"] },
  { id: "teeth_whitening", category: "dental", nameEn: "Teeth Whitening", nameAr: "تبييض الأسنان", priceKwd: 60, discountPct: 20, cashbackKwd: 5, clinicIds: ["farwaniya"] },
  { id: "polishing", category: "dental", nameEn: "Polishing", nameAr: "تلميع", priceKwd: 15, discountPct: 0, cashbackKwd: 0, clinicIds: ["farwaniya"] },
  { id: "crowns", category: "dental", nameEn: "Crowns", nameAr: "تلبيسات الأسنان", priceKwd: 120, discountPct: 15, cashbackKwd: 8, clinicIds: ["farwaniya"] },
  { id: "veneers", category: "dental", nameEn: "Veneers", nameAr: "فينير الأسنان", priceKwd: 150, discountPct: 15, cashbackKwd: 10, clinicIds: ["farwaniya"] },
  { id: "hollywood_smile", category: "dental", nameEn: "Hollywood Smile", nameAr: "ابتسامة هوليود", priceKwd: 350, discountPct: 20, cashbackKwd: 25, clinicIds: ["farwaniya"] },

  // ── Medical ──
  { id: "glutathione", category: "medical", nameEn: "Glutathione Drip", nameAr: "إبرة الجلوتاثيون", priceKwd: 30, discountPct: 10, cashbackKwd: 2, clinicIds: ["salmiya", "hawally"] },
  { id: "physiotherapy", category: "medical", nameEn: "Physiotherapy Sessions", nameAr: "جلسات علاج طبيعي", priceKwd: 25, discountPct: 10, cashbackKwd: 1, clinicIds: [] }
];
