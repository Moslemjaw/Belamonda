// Helpers, constants and small components shared by the CsDashboard tabs.
import i18n from "../../../app/i18n";

export const ar = () => i18n.language === "ar";

export const translateComplaintStatus = (status: string) => {
  if (!ar()) return status;
  switch (status) {
    case "open": return "مفتوح";
    case "in_progress": return "قيد المعالجة";
    case "escalated": return "تم التصعيد";
    case "resolved": return "محلول";
    case "closed": return "مغلق";
    default: return status;
  }
};
