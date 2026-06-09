import { listCashbackOffers, listFeaturedOffers, listMembershipOffers } from "./offer.service.js";
import { listCategoriesPublic } from "./category.service.js";

export async function getHomePayload() {
  const [featuredOffers, categories, cashbackOffers, membershipOffers] = await Promise.all([
    listFeaturedOffers(8),
    listCategoriesPublic(),
    listCashbackOffers(6),
    listMembershipOffers(6),
  ]);

  const services = categories
    .filter((c) => c.slug !== "all")
    .slice(0, 8)
    .map((c) => ({ id: c.id, nameEn: c.nameEn, nameAr: c.nameAr, slug: c.slug }));

  return {
    featuredOffers,
    categoriesPreview: categories.slice(0, 12),
    cashbackOffers,
    membershipOffers,
    services,
  };
}
