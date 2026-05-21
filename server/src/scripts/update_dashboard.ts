import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(__dirname, "../../../client/src/pages/dashboards/CustomerDashboard.tsx");

let content = fs.readFileSync(dashboardPath, "utf-8");

// 1. Remove the cancel button logic
const cancelBtnStart = `                            {uo.status === "enet_rejected" && (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                                {ar() ? "رفضت ENET الطلب. جرّبي خطة دفع أخرى." : "ENET declined. Try a different payment plan."}
                              </div>
                            )}`;

const cancelBtnEnd = `                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>`;

const cancelBlockRegex = new RegExp(
  cancelBtnStart.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&') +
  "[\\s\\S]*?{uo\\.status === \"active\" && \\([\\s\\S]*?<\\/div>\\s*\\)}[\\s\\S]*?<\\/div>\\s*\\);\\s*}\\)}\\s*<\\/div>\\s*\\)}\\s*<\\/div>\\s*<\\/div>"
);

content = content.replace(cancelBlockRegex, cancelBtnStart + "\n                          </div>\n                        );\n                      })}\n                    </div>\n                  )}\n                </div>\n              </div>");

// 2. Fix the purchased packages card (price and method)
content = content.replace(
  `<div className="text-xs text-surface-500 mt-0.5">{ar() ? "طريقة الدفع:" : "Method:"} {o.method}</div>`,
  `<div className="text-xs text-surface-500 mt-0.5">{ar() ? "طريقة الدفع:" : "Method:"} {o.paymentMethod || o.method || o.purchaseMode || (ar() ? "خدمة العملاء / العيادة" : "Customer Service / Clinic")}</div>`
);

content = content.replace(
  `<div className="font-black text-brand-pink-500">{o.amount || "0 KWD"}</div>`,
  `<div className="font-black text-brand-pink-500">{o.paymentAmountKwd || o.amount || o.subscriptionPriceKwd || o.totalSignupCashbackKwd || "0"} KWD</div>`
);

// 3. Move "Booked Sessions" and "Booking Requests" BEFORE "Purchased Packages"
// We need to extract the "Purchased Packages" section, and place it AFTER the "Booked Sessions" section.
const purchasedPackagesRegex = /<div>\s*<h3 className="text-base font-bold text-surface-700 mb-3">{ar\(\) \? "الباقات المشتراة" : "Purchased Packages"}<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const purchasedMatch = content.match(purchasedPackagesRegex);
if (purchasedMatch) {
  const purchasedHtml = purchasedMatch[0];
  content = content.replace(purchasedPackagesRegex, ""); // Remove it from current position

  // Find the end of "Booked Sessions" block
  const bookedSessionsRegex = /<div>\s*<h3 className="text-base font-bold text-surface-700 mb-3">{ar\(\) \? "الجلسات المحجوزة" : "Booked Sessions"}<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
  
  const bookedMatch = content.match(bookedSessionsRegex);
  if (bookedMatch) {
    const bookedHtml = bookedMatch[0];
    content = content.replace(bookedSessionsRegex, bookedHtml + "\n\n              {/* Purchased Packages (Moved here) */}\n              " + purchasedHtml);
  }
}

fs.writeFileSync(dashboardPath, content, "utf-8");
console.log("Successfully updated CustomerDashboard.tsx!");
