export const treatmentCategories: { id: string; nameEn: string; nameAr: string }[] = [];

export type Clinic = { id: string; nameEn: string; nameAr: string };

export const clinics: Clinic[] = [];

export type Treatment = {
  id: string;
  category: string;
  nameEn: string;
  nameAr: string;
  priceKwd: number;
  discountPct: number;
  cashbackKwd: number;
  clinicIds: string[];
};

export const allTreatments: Treatment[] = [];
