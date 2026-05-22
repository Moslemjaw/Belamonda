/**
 * Seed script — Creates all e-forms for:
 *   • Jamali           (Full Payment, 2 Installments, Deposit)
 *   • Mini Jamali      (Full Payment, 2 Installments, Deposit)
 *   • Naumi Classic    (Full Payment, 2 Installments, Deposit)
 *   • Naumi Plus       (Full Payment, 2 Installments, Deposit)
 *   • Sabaya           (Full Payment, 2 Installments, Deposit)
 *
 *  Run:  npx tsx src/scripts/seed_eforms.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { EFormModel } from "../models/eform.model.js";
import { OfferModel } from "../models/offer.model.js";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/belamonda";

// ─── Shared fields every contract uses ──────────────────────────────────────

function clientDetailsFields(prefix: string) {
  return [
    {
      key: `${prefix}_name_full`,
      type: "short_text",
      labelEn: "Full Name",
      labelAr: "الاسم الكامل",
      required: true,
      order: 1,
    },
    {
      key: `${prefix}_civil_id`,
      type: "short_text",
      labelEn: "Civil ID",
      labelAr: "الرقم المدني",
      required: true,
      order: 2,
    },
    {
      key: `${prefix}_mobile`,
      type: "short_text",
      labelEn: "Mobile Number",
      labelAr: "رقم الموبايل",
      required: true,
      order: 3,
    },
  ];
}

// ─── Jamali Terms & Conditions (from the real form — Image 1) ───────────────

const JAMALI_TERMS_AR = `الشروط والأحكام:

1) تقدم بطاقة جمالي خدماتها من خلال المراكز المقترحة من قبل شركة بيلاموندو للدعاية والتسويق وأن الشبكة الطبية خاضعة للتحديث بشكل مستمر (بالإضافة أو الحذف) ويتم الإعلان بشكل دوري ورسمي عن طريق وسائل الإعلام الإلكترونية الخاصة بالشركة ويكون العميل مسئولاً عن متابعة تلك التغييرات والشركة غير ملزمة بإخباره بها منفرداً.

2) يلتزم العميل بالشروط والأحكام الخاصة بمركز من مراكز الخدمة لأي المسئولية على شركة بيلاموندو سواء كانت مدنية أو جنائية حيال العميل.

3) يلتزم بيلاموندو للدعاية والتسويق في مجرد مسوق لبطاقة جمالي وفي حالة حصول العميل للاشتراكات الخاصة بمراكز الخدمة المقترحة لا تتحمل شركة أي مسئولية سواء مدنية أو جنائية حيال العميل.

4) يبرأ العميل ذمة شركة بيلاموندو من أي أخطاء مهنية أو طبية تلحق به داخل المراكز الطبية المتعاقد له ولا يجوز الرجوع على شركة بيلاموندو بأي تعويضات مالية نتيجة لهذا الخطأ كونها شركة دعاية وتسويق وليست لها صلة بالخدمات الطبية المقدمة من المراكز الطبية الخاضعة بالبطاقة سالف الذكر بعالية.

5) يلتزم العميل بسداد كامل الأقساط المستحقة على البطاقة قبل استلامها وذلك وفقاً لجدول الأقساط سالف الذكر أعلاه.

6) يتميز عميل جمالي بميزة (الكاش باك) على بطاقة جمالي حسب القائمة الملحقة بالعقد بأن لا يتم استبدالها بمبالغ نقدية حقيقية وان تخصم من مبلغ الخدمات المقدمة للعميل.

7) في حالة طلب العميل إلغاء بطاقة جمالي قبل سداد قيمة الأقساط كاملة وقبل إصدارها يلتزم العميل بدفع 50% من قيمة البطاقة كاملة قبل الإلغاء.

8) في حالة طلب العميل إلغاء بطاقة جمالي بعد إصدارها لا ترد إليه أية مبالغ مالية من قيمة البطاقة المسددة للشركة وتلك الأقساط من خالص حق الشركة ولا يحق للعميل طلب استردادها.

9) يلتزم العميل باستخدام البطاقة لنفسه فقط ودون غيره وان كانوا من أفراد أسرته وفي حالة مخالفة لهذا الشرط للشركة الحق بإلغاء البطاقة.

10) يلتزم العميل بسداد كامل الأقساط بالقيمة الزمنية المحددة وفقاً لجدول الأقساط سالف الذكر أعلاه، وفي حال تأخر عن سداد القسط في المواعيد المتفق عليها يلتزم بدفع 2 دينار كويتي عن كل يوم تأخير عن موعد القسط المحدد.

11) في حالة إيقاف البطاقة أو إلغائها لأي سبب لا يحق للعميل الرجوع على الشركة بأي تعويضات ويبرأ العميل ذمة الشركة من أية مبالغ مطالب بها.

12) مدة البطاقة سنة من تاريخ الإصدار وتجدد بموافقة الطرفين ويتفق من جديد.

13) يقر العميل بعلمه التام أن قيمة التغطيات والخدمات التي تقدمها المراكز المقترحة من الشركة والخاصة بالبطاقة لا تعتد عند تجديد عقود الشركة مع تلك المراكز.

14) يحق للشركة إنهاء عقودها مع أي من المراكز المقترحة التي تتعامل معها ولا يحق للعميل الاعتراض على هذا الإلغاء أو طلب تعويضات بسبب بطاقة جمالي أو أن يمثلها سبب هذا الإلغاء.

15) يحق للشركة إلغاء البطاقة آنفا سريانها بموجب توجيه إخطار مدته 30 يوماً للعميل ويصبح الإلغاء نافذاً في اليوم الذي يلي آخر يوم من مدة الإخطار مباشرةً ويصبح تاريخ الإلغاء ولن تكون الشركة مسئولة عن أي مصاريف متكبدة بتاريخ الإلغاء أو بعده.

16) لا يستوجب إرجاع القيمة الموضحة بالبند السابق للعميل في حالة امتناعه عن إرجاع البطاقة للشركة في موعد أقصاه 15 يوم من تاريخ سريان الإلغاء.

17) أقر بإطلاعي على الشروط والأحكام أعلاه وأوافق عليها.`;

const JAMALI_TERMS_EN = `Terms & Conditions:

1) Jamali card services are provided through centers proposed by Belamonda for Advertising & Marketing. The medical network is subject to continuous updates (additions or removals) announced periodically through official electronic media channels. The client is responsible for following these changes.

2) The client commits to the terms and conditions of each service center. Belamonda bears no civil or criminal liability towards the client.

3) Belamonda acts solely as a marketer for the Jamali card. In the event of subscriptions through proposed service centers, the company bears no civil or criminal liability.

4) The client absolves Belamonda from any professional or medical errors within contracted medical centers. No financial compensation claims can be made against Belamonda.

5) The client must pay all installments due on the card before receiving it, according to the installment schedule above.

6) Jamali cardholders enjoy a "Cashback" feature per the attached list, which cannot be exchanged for actual cash and shall only be deducted from service charges.

7) If the client requests cancellation before full installment payment and before issuance, the client must pay 50% of the full card value.

8) If the client requests cancellation after issuance, no amounts shall be refunded. All paid installments are the company's right.

9) The card is for personal use only, not transferable to family members. Violation allows the company to cancel the card.

10) The client must pay all installments on schedule. A delay fee of 2 KWD per day applies for late payments.

11) If the card is suspended or cancelled for any reason, the client may not claim compensation from the company.

12) Card validity is one year from issuance, renewable by mutual agreement.

13) The client acknowledges that coverage values do not apply when the company renews contracts with centers.

14) The company may terminate agreements with any proposed center. The client may not object or claim compensation.

15) The company may cancel the card with 30 days' notice. The company bears no responsibility for expenses incurred on or after the cancellation date.

16) No refund is due if the client fails to return the card within 15 days of cancellation.

17) I confirm I have read and agree to the above terms and conditions.`;

// ─── Naumi Terms & Conditions (from Image 2 — dark form) ────────────────────

const NAUMI_TERMS_AR = `الشروط والأحكام:

1) تقر المشتركة بالبطاقة المشار إليها أعلاه بأنها اطلعت و توقيعها على هذا الإقرار يعد بمثابة إقرار بالقبول مشاركتها بالبطاقة وموافقتها التامة على الشروط المذكورة على ظهر البطاقة والمرسوة عبر الوسائل الإعلامية.

2) تلتزم المشتركة بالإلتزام بالأوقات المخصصة للحجز المشار إليها وفي حال مخالفة ذلك وعدم إلغاء الحجوز الخاصة بالبطاقة قبل الموعد بمدة لا تقل عن 500 فلس تحتسب لصالح الشركة ويخصم من مبالغ حساب.

3) مدة استخدام البطاقة هي سنة ميلادية بدءا من تاريخ قبول بالبطاقة.

4) كل ما يترتب على تلك الخدمات وما فيها المسائل من اختلاط أو غير ذلك حالات أو خلل طبي فإنها تقع على عاتق مقدم الخدمات وليس لها علاقة بشركة بيلاموندو.

5) تقر المشتركة بأنها وقعت على هذا الإقرار والي والنظر قامت بمعاملة جسمها وان أي اختلاف أو مشكلة طبية قد تتعرض فيها ذلك طبيعة.

6) تقر المشتركة بمسئولية شركة بيلاموندو للدعاية والتسويق بأن أي إهمال بجميع قبل المراكز الطبية المتعاقد معها، ومباشرة وليست لها صلة بالخدمات الطبية.

7) تقر المشتركة الاشتراك في الخدمة الخاصة الموضحة أعلاه وهي حصة Full Body فقط ولا يشمل الإشتراك في غير ما هو منصوص عليه في هذا الاقرار.

8) تقر المشتركة بأنها سيدة ولا يحق لأي شخص آخر أو أكثر من عائلتها استخدام البطاقة.

9) تقر المشتركة بأن يتم إيداع مبلغ وقدره (2) دينار كويتي عند حضورها للعيادة وذلك نظراً لعدم جدية اللقطة والحجز وفي حالة عدم حضور المشتركة في الموعد المحدد ينقص المبلغ من القيمة البطاقة وعلى ذلك تكون قد استحقت.

10) إن المشتركة بمجرد استخدامات الأظافر العادية فإنها ليست مشمولة بل تصنف Full Body حيث أنه من خدمات الأظافر 3D أو غيرها يجب على المشتركة الاطلاع على قائمة الخدمات والبالتالي لدفع الفرق إن وجد.

11) تقر المشتركة بأنها في حالة التواصل مع المركز ولم تقدم المتابع المتفق عليها فيما هذا الأقرار من العميلة يثبت ذلك.

12) تقر المشتركة بأن مدة البطاقة هذه سنة أي 12 شهر فقط من تاريخ البطاقة ففي حالة عدم استخدام البطاقة يقتضي سداد كامل قيمة البطاقة عن كل الخدمات المتبقية والمتفق عليها.

13) يحق للمشتركة أنها قد تأتي بتقرير طبي يثبت فترة حملها يجب أن تبلغ الشركة بمستند أصلي وقد تم تجميد صلاحية البطاقة لا يسمح بإلغائها ولا يسمح إلا بمبلغ نقدية فعليه.

14) في حالة رغبة العميل بالتوقف عن حضور أي مركز كل سنة مرة فرصة ويصبح مبلغ ما يقدره 10 دك أي اضافة على سعر التعاقد.

15) إذ تصرف تسجيل عدم تعرض لحق أي تصوير الكبير أو خاص بأي شخص أو مرجع من أي نوع كان للموقع الطرف القانوني أو أي مرجع خارج حق أو مسئولية قانونية على ذلك الشركة.`;

const NAUMI_TERMS_EN = `Terms & Conditions:

1) The subscriber acknowledges that by signing this declaration she accepts her participation with the card and agrees to all terms stated on the card and communicated through media channels.

2) The subscriber must adhere to designated booking times. Failure to cancel bookings in advance will result in a 500 fils charge deducted from her account.

3) The card usage period is one calendar year from the date of card acceptance.

4) Any issues arising from services, including medical complications, are the responsibility of the service provider, not Belamonda.

5) The subscriber acknowledges she has signed this declaration voluntarily and that any medical difference or problem she may encounter is of a natural nature.

6) The subscriber acknowledges Belamonda's role as an advertising and marketing company with no direct connection to the medical services provided.

7) The subscriber's subscription covers Full Body services only, as specified in this declaration.

8) The card is for personal use only — no other family member may use it.

9) A deposit of 2 KWD is required at each clinic visit for booking commitment. If the subscriber fails to attend, the amount is deducted from the card value.

10) Regular nail services are not included in Full Body coverage. 3D or specialty nail services require the subscriber to review the service list and pay any difference.

11) The subscriber acknowledges that failure to follow up with the center as agreed in this declaration voids certain commitments.

12) The card is valid for exactly 12 months from issuance date. If unused, the full card value for all remaining agreed services must be paid.

13) The subscriber may present a medical report proving pregnancy to freeze card validity; cancellation or cash refund is not permitted.

14) If the subscriber wishes to stop attending any center once per year, an additional 10 KWD fee applies on top of the contract price.

15) No unauthorized recording, photography, or sharing of any content related to the service locations is permitted under any circumstances.`;

// ─── Sabaya Terms & Conditions (from Image 3 — dark form) ───────────────────

const SABAYA_TERMS_AR = `الشروط والأحكام:

1) تقر المشتركة بالبطاقة المشار إليها أعلاه بأنها اطلعت و توقيعها على هذا الإقرار يعد بمثابة إقرار بالقبول لمشاركتها بالبطاقة وموافقتها التامة على الشروط المذكورة.

2) تلتزم المشتركة بالالتزام بالأوقات المخصصة للحجز المشار إليها وفي حال مخالفة ذلك وعدم استخدام البطاقة واتاحتها للبطاقة قبل الموعد بمدة لا تقل عن 500 فلس تحتسب لصالح الشركة ويخصم من مبالغ حساب التسويق.

3) مدة استخدام البطاقة هي سنة ميلادية بدءاً من تاريخ قبول بالبطاقة.

4) كل ما يترتب على تلك الخدمات وما فيها المسائل من اختلاط أو غير ذلك حالات أو خلل طبي فإنها تقع على عاتق مقدم الخدمات.

5) تقر المشتركة بأنها وقعت على هذا الإقرار والنظر قامت بمعاملة جسمها وان أي اختلاف أو مشكلة طبية قد تتعرض فيها ذلك طبيعة.

6) تقر المشتركة بمسئولية شركة بيلاموندو للدعاية والتسويق بأن أي إهمال بجميع قبل المراكز الطبية المتعاقد معها ومباشرة وليست لها صلة بالخدمات الطبية المقدمة.

7) تقر المشتركة الاشتراك في الخدمة الخاصة الموضحة أعلاه وهي حصة Full Body فقط ولا يشمل الإشتراك في غير ما هو منصوص عليه.

8) تقر المشتركة بأنها سيدة ولا يحق لأي شخص آخر من عائلتها استخدام البطاقة.

9) تقر المشتركة بأنه يتم إيداع مبلغ وقدره (2) دينار كويتي عند حضورها للعيادة نظراً لعدم جدية اللقطة والحجز وفي حالة عدم حضور المشتركة في الموعد المحدد ينقص المبلغ.

10) تقر المشتركة بأنها في حالة التواصل مع المركز ولم تقدم المتابع المتفق عليها يثبت ذلك.

11) تقر المشتركة بأن مدة البطاقة هذه سنة أي 12 شهر فقط من تاريخ البطاقة.

12) يحق للمشتركة التقدم بتقرير طبي يثبت فترة حملها لتجميد صلاحية البطاقة ولا يسمح بإلغائها ولا يسمح إلا بمبلغ نقدية فعلية.

13) في حالة رغبة العميل بالتوقف عن حضور أي مركز كل سنة مرة فرصة ويصبح مبلغ ما يقدره 10 دك أي اضافة على سعر التعاقد.

14) يمنع تصوير تسجيل بالعيادة أو أي شخص من أي نوع كان للموقع أو مرجع خارج أي مسئولية قانونية على ذلك الشركة.`;

const SABAYA_TERMS_EN = `Terms & Conditions:

1) The subscriber acknowledges that by signing this declaration she accepts her participation with the card and agrees to all stated terms.

2) The subscriber must adhere to booking times. Failure to cancel in advance results in a 500 fils charge deducted from the marketing account.

3) Card usage period is one calendar year from the date of acceptance.

4) Any issues arising from services, including medical complications, are the responsibility of the service provider.

5) The subscriber voluntarily signed this declaration and acknowledges that any medical issues are of a natural nature.

6) Belamonda bears no responsibility for negligence by contracted medical centers and has no connection to the medical services provided.

7) The subscription covers Full Body services only as specified herein.

8) The card is for personal use only — no family member may use it.

9) A deposit of 2 KWD is required at each clinic visit for booking commitment. Non-attendance results in deduction.

10) The subscriber acknowledges that failure to follow up with the center as agreed voids certain commitments.

11) The card is valid for exactly 12 months from issuance date.

12) The subscriber may present a medical report proving pregnancy to freeze card validity; cancellation or cash refund is not permitted.

13) If the subscriber wishes to stop attending any center, an additional 10 KWD fee applies.

14) No unauthorized recording or photography is permitted at the clinic.`;


// ─── Form builder ───────────────────────────────────────────────────────────

type PaymentType = "full_payment" | "installments_2" | "deposit";

interface FormSpec {
  offerName: string;
  offerNameAr: string;
  paymentType: PaymentType;
  termsAr: string;
  termsEn: string;
}

function paymentLabel(pt: PaymentType): { en: string; ar: string } {
  switch (pt) {
    case "full_payment": return { en: "Full Payment", ar: "دفع كامل" };
    case "installments_2": return { en: "2 Installments", ar: "قسطين" };
    case "deposit": return { en: "Deposit", ar: "عربون" };
  }
}

function buildFormDocument(spec: FormSpec) {
  const pl = paymentLabel(spec.paymentType);
  const title = `${spec.offerName} — ${pl.en}`;
  const titleAr = `${spec.offerNameAr} — ${pl.ar}`;

  const fields: any[] = [
    // Client details section header
    {
      key: "section_client",
      type: "static_text",
      labelEn: "📋 Client Details / بيانات المشترك",
      labelAr: "📋 بيانات المشترك",
      required: false,
      order: 0,
    },
    ...clientDetailsFields(spec.offerName.toLowerCase().replace(/\s+/g, "_")),

    // Number of cards
    {
      key: "num_cards",
      type: "short_text",
      labelEn: "Number of Cards",
      labelAr: "عدد البطاقات",
      helpText: "How many cards is the client purchasing?",
      required: true,
      order: 4,
    },

    // Total amount
    {
      key: "total_amount",
      type: "short_text",
      labelEn: "Total Amount (KWD)",
      labelAr: "المبلغ الإجمالي (د.ك)",
      helpText: "Total price for all cards in Kuwaiti Dinar",
      required: true,
      order: 5,
    },
  ];

  let orderCounter = 6;

  // Payment-specific fields
  if (spec.paymentType === "full_payment") {
    fields.push({
      key: "payment_full_amount",
      type: "short_text",
      labelEn: "Amount Paid at Signing (KWD)",
      labelAr: "المبلغ المدفوع عند التوقيع (د.ك)",
      required: true,
      order: orderCounter++,
    });
  }

  if (spec.paymentType === "installments_2") {
    fields.push(
      {
        key: "section_installments",
        type: "static_text",
        labelEn: "💳 Installment Schedule / جدول الأقساط",
        labelAr: "💳 جدول الأقساط",
        required: false,
        order: orderCounter++,
      },
      {
        key: "inst1_amount",
        type: "short_text",
        labelEn: "1st Installment Amount (KWD) — Due at Signing",
        labelAr: "القسط الأول (د.ك) — مستحق عند التوقيع وطلب الشراء",
        required: true,
        order: orderCounter++,
      },
      {
        key: "inst2_amount",
        type: "short_text",
        labelEn: "2nd Installment Amount (KWD)",
        labelAr: "القسط الثاني (د.ك)",
        required: true,
        order: orderCounter++,
      },
      {
        key: "inst2_date",
        type: "date",
        labelEn: "2nd Installment Due Date",
        labelAr: "تاريخ استحقاق القسط الثاني",
        required: true,
        order: orderCounter++,
      }
    );
  }

  if (spec.paymentType === "deposit") {
    fields.push(
      {
        key: "section_deposit",
        type: "static_text",
        labelEn: "💰 Deposit Details / تفاصيل العربون",
        labelAr: "💰 تفاصيل العربون",
        required: false,
        order: orderCounter++,
      },
      {
        key: "deposit_amount",
        type: "short_text",
        labelEn: "Deposit Amount (KWD) — Due at Signing",
        labelAr: "مبلغ العربون (د.ك) — مستحق عند التوقيع",
        required: true,
        order: orderCounter++,
      },
      {
        key: "remaining_amount",
        type: "short_text",
        labelEn: "Remaining Balance (KWD)",
        labelAr: "المبلغ المتبقي (د.ك)",
        required: true,
        order: orderCounter++,
      },
      {
        key: "remaining_due_date",
        type: "date",
        labelEn: "Remaining Balance Due Date",
        labelAr: "تاريخ استحقاق المبلغ المتبقي",
        required: true,
        order: orderCounter++,
      }
    );
  }

  // Terms & Conditions
  fields.push(
    {
      key: "section_terms",
      type: "static_text",
      labelEn: `📜 Terms & Conditions / الشروط والأحكام\n\n${spec.termsEn}`,
      labelAr: `📜 الشروط والأحكام\n\n${spec.termsAr}`,
      required: false,
      order: orderCounter++,
    },
    {
      key: "accept_terms",
      type: "single_choice",
      labelEn: "I have read and agree to all terms & conditions above",
      labelAr: "أقر بإطلاعي على الشروط والأحكام أعلاه وأوافق عليها",
      required: true,
      options: ["Yes / نعم"],
      order: orderCounter++,
    },
    // Date
    {
      key: "agreement_date",
      type: "date",
      labelEn: "Date",
      labelAr: "التاريخ",
      required: true,
      order: orderCounter++,
    },
    // Signature
    {
      key: "customer_signature",
      type: "signature",
      labelEn: "Customer Signature",
      labelAr: "التوقيع",
      required: true,
      order: orderCounter++,
    }
  );

  return {
    title,
    titleAr,
    description: `${spec.offerName} — ${pl.en} agreement form`,
    descriptionAr: `نموذج اتفاقية ${spec.offerNameAr} — ${pl.ar}`,
    fields,
    targets: [] as any[], // Will be linked to the offer after we find its ID
    requireBeforeBooking: false,
    requireBeforeFirstPayment: true,
    archived: false,
    version: 1,
    createdBy: "system",
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Fetch offer IDs
  const offers = await OfferModel.find({
    name: { $in: ["Jamali", "Mini Jamali", "Naumi Plus", "Sabaya"] },
  }).lean();

  const offerMap = new Map<string, string>();
  for (const o of offers as any[]) {
    offerMap.set(o.name, o._id.toString());
  }

  console.log("📦 Found offers:", [...offerMap.keys()].join(", "));

  // Check for Naumi Classic — it might not exist yet; we'll create a placeholder note
  if (!offerMap.has("Naumi Classic")) {
    // Try to find by alternative names
    const naumiClassic = (await OfferModel.findOne({
      name: { $regex: /naumi.*classic/i },
    }).lean()) as any;
    if (naumiClassic) {
      offerMap.set("Naumi Classic", naumiClassic._id.toString());
    } else {
      console.log("⚠️  Naumi Classic offer not found in DB — forms will be created without offer linking (can be linked later from Admin panel)");
    }
  }

  // Define all form specs
  const allSpecs: FormSpec[] = [];
  const paymentTypes: PaymentType[] = ["full_payment", "installments_2", "deposit"];

  // Jamali
  for (const pt of paymentTypes) {
    allSpecs.push({
      offerName: "Jamali",
      offerNameAr: "جمالي",
      paymentType: pt,
      termsAr: JAMALI_TERMS_AR,
      termsEn: JAMALI_TERMS_EN,
    });
  }

  // Mini Jamali
  for (const pt of paymentTypes) {
    allSpecs.push({
      offerName: "Mini Jamali",
      offerNameAr: "ميني جمالي",
      paymentType: pt,
      termsAr: JAMALI_TERMS_AR, // Same terms as Jamali
      termsEn: JAMALI_TERMS_EN,
    });
  }

  // Naumi Classic
  for (const pt of paymentTypes) {
    allSpecs.push({
      offerName: "Naumi Classic",
      offerNameAr: "ناعمي كلاسيك",
      paymentType: pt,
      termsAr: NAUMI_TERMS_AR,
      termsEn: NAUMI_TERMS_EN,
    });
  }

  // Naumi Plus
  for (const pt of paymentTypes) {
    allSpecs.push({
      offerName: "Naumi Plus",
      offerNameAr: "ناعمي بلس",
      paymentType: pt,
      termsAr: NAUMI_TERMS_AR,
      termsEn: NAUMI_TERMS_EN,
    });
  }

  // Sabaya
  for (const pt of paymentTypes) {
    allSpecs.push({
      offerName: "Sabaya",
      offerNameAr: "صبايا",
      paymentType: pt,
      termsAr: SABAYA_TERMS_AR,
      termsEn: SABAYA_TERMS_EN,
    });
  }

  let created = 0;
  let skipped = 0;

  for (const spec of allSpecs) {
    const doc = buildFormDocument(spec);
    const pl = paymentLabel(spec.paymentType);

    // Link to offer if we have its ID
    const offerId = offerMap.get(spec.offerName);
    if (offerId) {
      doc.targets = [{ kind: "offer", refId: offerId }];
    }

    // Check if this form already exists (avoid duplicates)
    const existing = await EFormModel.findOne({ title: doc.title, archived: false }).lean();
    if (existing) {
      console.log(`  ⏩ Already exists: "${doc.title}" — skipping`);
      skipped++;
      continue;
    }

    const saved = await EFormModel.create(doc);
    console.log(`  ✅ Created: "${doc.title}" (ID: ${saved._id})`);

    // Also link the form to the offer's eform fields if possible
    if (offerId) {
      const updateField: Record<string, any> = {};
      if (spec.paymentType === "full_payment") updateField.fullPaymentEFormId = saved._id;
      if (spec.paymentType === "installments_2") updateField.installmentsEFormId = saved._id;
      if (spec.paymentType === "deposit") updateField.depositEFormId = saved._id;

      await OfferModel.findByIdAndUpdate(offerId, { $set: updateField });
      console.log(`     🔗 Linked to "${spec.offerName}" offer (${spec.paymentType})`);
    }

    created++;
  }

  console.log(`\n🏁 Done! Created ${created} forms, skipped ${skipped} existing.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
