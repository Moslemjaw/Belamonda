import { useTranslation } from "react-i18next";

export function BelamondaLogo({
  size = 40,
  showText = true,
  className = "",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="translate-y-1"
      >
        {/* Lotus petals */}
        <path
          d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z"
          fill="#F59AB9"
          opacity="0.9"
        />
        <path
          d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z"
          fill="#F59AB9"
          opacity="0.6"
        />
        <path
          d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z"
          fill="#F59AB9"
          opacity="0.6"
        />
        <path
          d="M12 35C12 35 12 45 20 52C26 57 34 55 40 55C30 55 15 52 12 35Z"
          fill="#F59AB9"
          opacity="0.35"
        />
        <path
          d="M68 35C68 35 68 45 60 52C54 57 46 55 40 55C50 55 65 52 68 35Z"
          fill="#F59AB9"
          opacity="0.35"
        />
        {/* Leaf accents */}
        <path
          d="M10 58C10 58 18 52 28 56C28 56 18 60 10 58Z"
          fill="#C7CAAB"
          opacity="0.7"
        />
        <path
          d="M70 58C70 58 62 52 52 56C52 56 62 60 70 58Z"
          fill="#C7CAAB"
          opacity="0.7"
        />
        {/* Inner face silhouette */}
        <circle cx="40" cy="35" r="8" fill="white" opacity="0.25" />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-surface-900">
            {isAr ? "بيلاموندو" : "Belamonda"}
          </span>
          <span className="text-[10px] font-medium text-surface-400 -mt-0.5 tracking-wider uppercase">
            {isAr ? "الجمال والعناية" : "Beauty & Wellness"}
          </span>
        </div>
      )}
    </div>
  );
}

export function BelamondaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z"
        fill="#F59AB9"
        opacity="0.9"
      />
      <path
        d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z"
        fill="#F59AB9"
        opacity="0.6"
      />
      <path
        d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z"
        fill="#F59AB9"
        opacity="0.6"
      />
      <path
        d="M10 58C10 58 18 52 28 56C28 56 18 60 10 58Z"
        fill="#C7CAAB"
        opacity="0.7"
      />
      <path
        d="M70 58C70 58 62 52 52 56C52 56 62 60 70 58Z"
        fill="#C7CAAB"
        opacity="0.7"
      />
    </svg>
  );
}
