import { listFeaturedOffers } from "./offer.service.js";
import { listCategoriesPublic } from "./category.service.js";

export async function getHomePayload() {
  const [featuredOffers, categories] = await Promise.all([
    listFeaturedOffers(8),
    listCategoriesPublic()
  ]);
  return {
    featuredOffers,
    categoriesPreview: categories.slice(0, 12),
    ctas: {
      browsePath: "/login",
      signupPath: "/login",
      loginPath: "/login"
    }
  };
}
