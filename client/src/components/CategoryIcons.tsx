import React from "react";

const strokeProps = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const CategoryIconMap: Record<string, React.ReactNode> = {
  laser: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  injectables: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M18 2l4 4-14 14-4-4L18 2z" />
      <path d="M14 6l4 4" />
      <path d="M2 22l4-4" />
      <path d="M9 11l1.5 1.5" />
      <path d="M12 8l1.5 1.5" />
    </svg>
  ),
  skincare: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M12 2c0 0-8 7-8 13a8 8 0 0016 0c0-6-8-13-8-13z" />
      <path d="M12 12v6" />
    </svg>
  ),
  "advanced-skin": (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M8 12h2" />
      <path d="M14 12h2" />
      <path d="M12 9v6" />
    </svg>
  ),
  "plasma-hair": (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M12 2a5 5 0 00-5 5c0 3 2 5 2 8h6c0-3 2-5 2-8a5 5 0 00-5-5z" />
      <path d="M9 15h6" />
      <path d="M10 19h4" />
      <path d="M11 22h2" />
    </svg>
  ),
  body: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <circle cx="12" cy="5" r="2" />
      <path d="M8 9h8" />
      <path d="M12 9v7" />
      <path d="M9 22l3-6 3 6" />
    </svg>
  ),
  "fat-reduction": (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M12 2c-2 4-6 6-4 11a6 6 0 0012 0c0-4-4-7-4-11z" />
      <path d="M10 14c0 2 1 3 2 3s2-1 2-3" />
    </svg>
  ),
  beauty: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M12 3l1.5 5h5l-4 3 1.5 5L12 13l-4 3 1.5-5-4-3h5L12 3z" />
    </svg>
  ),
  removal: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M20 5H9L2 12l7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
      <path d="M18 9l-6 6" />
      <path d="M12 9l6 6" />
    </svg>
  ),
  dental: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <path d="M9 2C7 2 5 4 5 7c0 2.5 1 4 1 7s1 6 3 6c1.5 0 2-2 3-2s1.5 2 3 2c2 0 3-3 3-6s1-4.5 1-7c0-3-2-5-4-5-1 0-2 1-3 1S10 2 9 2z" />
    </svg>
  ),
  medical: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <polyline points="2,12 6,12 8,5 11,19 13,10 15,14 17,14 22,14" />
    </svg>
  ),
  all: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
};

export function getCategoryIcon(slug: string): React.ReactNode {
  const s = (slug ?? "").toLowerCase();
  if (CategoryIconMap[s]) return CategoryIconMap[s];
  if (s.includes("laser")) return CategoryIconMap["laser"];
  if (s.includes("inject")) return CategoryIconMap["injectables"];
  if (s.includes("advanced") || s.includes("technology") || s.includes("tech")) return CategoryIconMap["advanced-skin"];
  if (s.includes("plasma") || s.includes("hair")) return CategoryIconMap["plasma-hair"];
  if (s.includes("fat") || s.includes("slim") || s.includes("contour") || s.includes("reduction")) return CategoryIconMap["fat-reduction"];
  if (s.includes("skin")) return CategoryIconMap["skincare"];
  if (s.includes("body")) return CategoryIconMap["body"];
  if (s.includes("remov") || s.includes("dissolv") || s.includes("tattoo")) return CategoryIconMap["removal"];
  if (s.includes("beauty") || s.includes("enhance") || s.includes("lip")) return CategoryIconMap["beauty"];
  if (s.includes("dental") || s.includes("teeth") || s.includes("tooth")) return CategoryIconMap["dental"];
  if (s.includes("medical") || s.includes("therapy") || s.includes("physio")) return CategoryIconMap["medical"];
  if (s === "all") return CategoryIconMap["all"];
  return CategoryIconMap["other"];
}
