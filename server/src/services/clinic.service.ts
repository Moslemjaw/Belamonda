import mongoose from "mongoose";
import { ClinicModel } from "../models/clinic.model.js";
import { serializeClinic } from "../utils/serialize.js";

export async function listClinics(opts: { activeOnly?: boolean } = {}) {
  const q = opts.activeOnly ? { active: true } : {};
  const rows = await ClinicModel.find(q).sort({ createdAt: -1 }).lean();
  return rows.map((r) => serializeClinic(r as any));
}

export async function getClinic(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await ClinicModel.findById(id).lean();
  return doc ? serializeClinic(doc as any) : null;
}

export async function createClinic(input: {
  nameEn: string;
  nameAr: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  categoryTags?: string[];
  operatingHours?: { open: string; close: string };
  active?: boolean;
}) {
  const doc = await ClinicModel.create(input);
  return serializeClinic(doc.toObject() as any);
}

export async function updateClinic(
  id: string,
  patch: Partial<{
    nameEn: string;
    nameAr: string;
    address: string;
    lat?: number;
    lng?: number;
    phone?: string;
    categoryTags?: string[];
    operatingHours?: { open: string; close: string };
    active?: boolean;
  }>
) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await ClinicModel.findByIdAndUpdate(id, patch, { new: true }).lean();
  return doc ? serializeClinic(doc as any) : null;
}
