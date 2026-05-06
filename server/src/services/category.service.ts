import mongoose from "mongoose";
import { CategoryModel } from "../models/category.model.js";
import { serializeCategory } from "../utils/serialize.js";

export async function listCategoriesPublic() {
  const rows = await CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, nameEn: 1 }).lean();
  return rows.map((r) => serializeCategory(r as any));
}

export async function listCategoriesAdmin() {
  const rows = await CategoryModel.find({}).sort({ sortOrder: 1, nameEn: 1 }).lean();
  return rows.map((r) => serializeCategory(r as any));
}

export async function createCategory(input: {
  nameAr: string;
  nameEn: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  const doc = await CategoryModel.create({
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    slug: input.slug.toLowerCase().trim(),
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0
  });
  return serializeCategory(doc.toObject() as any);
}

export async function updateCategory(
  id: string,
  patch: Partial<{ nameAr: string; nameEn: string; slug: string; sortOrder: number }>
) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await CategoryModel.findByIdAndUpdate(
    id,
    {
      ...patch,
      ...(patch.slug ? { slug: patch.slug.toLowerCase().trim() } : {})
    },
    { new: true }
  ).lean();
  return doc ? serializeCategory(doc as any) : null;
}

export async function setCategoryActivation(id: string, isActive: boolean) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await CategoryModel.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
  return doc ? serializeCategory(doc as any) : null;
}

export async function deleteCategory(id: string) {
  if (!mongoose.isValidObjectId(id)) return false;
  const res = await CategoryModel.findByIdAndDelete(id);
  return !!res;
}

export async function findCategoryBySlug(slug: string) {
  const doc = await CategoryModel.findOne({ slug: slug.toLowerCase() }).lean();
  return doc ? serializeCategory(doc as any) : null;
}

export async function findCategoryIdBySlug(slug: string): Promise<mongoose.Types.ObjectId | null> {
  const doc = (await CategoryModel.findOne({ slug: slug.toLowerCase() }).select("_id").lean()) as {
    _id?: mongoose.Types.ObjectId;
  } | null;
  return doc?._id ?? null;
}

export async function getCategoryIdsMap(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const rows = await CategoryModel.find({}).select("slug _id").lean();
  const m = new Map<string, mongoose.Types.ObjectId>();
  for (const r of rows) m.set(String(r.slug).toLowerCase(), r._id as mongoose.Types.ObjectId);
  return m;
}
