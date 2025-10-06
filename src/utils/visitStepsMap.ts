// utils/visitStepsMap.ts
export type StepKey =
  | "arrival_photos"
  | "availability"
  | "whcount"
  | "damage_reports"
  | "sos_reports"
  | "competitor_activity"
  | "remarks"
  | "promoter_reports"
  | "promoter_plus_reports"
  | "tl_details";

export type StepColumn = {
  key: string;
  labelAr: string;
  labelEn: string;
  type?: "text" | "number" | "datetime" | "image" | "boolean";
  /** لمعاونة SupaImg لو عندك ملف بدون مسار كامل */
  bucketHint?: string;
};

export type StepConfig = {
  titleAr: string;
  titleEn: string;
  table: string;
  select: string;
  defaultOrder?: { column: string; ascending: boolean };
  columns: StepColumn[];
  /** عرض أسماء بدل UUID */
  lookups?: Record<
    string,
    { table: string; select: string; labelField: string }
  >;
};

/** أسماء البَكِت زي ما هي في الكود الطويل */
const BUCKETS = {
  arrival: "arrival-photos",
  availability: "availability-photos",
  whcount: "whcount-photos",
  damage: "damage-photos",
  sos: "sos-photos",
  competitor: "competitor-photos",
  promoter: "promoter-reports",
  promoterPlus: "promoter-plus-photos",
  tl: "tlphotos",
} as const;

export const VISIT_STEPS: Record<StepKey, StepConfig> = {
  arrival_photos: {
    titleAr: "صور الوصول",
    titleEn: "Arrival Photos",
    table: "arrivalphotos",
    // من الكود الطويل: photos[] + arrival_time + created_at
    select: "id, visit_id, user_id, photos, arrival_time, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photos", labelAr: "الصور", labelEn: "Photos", type: "image", bucketHint: BUCKETS.arrival },
      { key: "arrival_time", labelAr: "وقت الوصول", labelEn: "Arrival Time", type: "datetime" },
      { key: "user_id", labelAr: "المستخدم", labelEn: "User" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
    lookups: {
      user_id: { table: "Users", select: "id,name,arabic_name", labelField: "name" },
    },
  },

  availability: {
    titleAr: "التوافر",
    titleEn: "Availability",
    table: "availabilitydata",
    // من الكود الطويل
    select:
      "id, visit_id, place_id, category_id, product_name, is_available, quantity, reason, custom_reason, item_photo, reason_photos, place_photos, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "product_name", labelAr: "المنتج", labelEn: "Product" },
      { key: "is_available", labelAr: "متاح؟", labelEn: "Available?", type: "boolean" },
      { key: "quantity", labelAr: "الكمية", labelEn: "Qty", type: "number" },
      { key: "reason", labelAr: "السبب", labelEn: "Reason" },
      { key: "custom_reason", labelAr: "سبب مخصص", labelEn: "Custom Reason" },
      { key: "item_photo", labelAr: "صورة المنتج", labelEn: "Item Photo", type: "image", bucketHint: BUCKETS.availability },
      { key: "reason_photos", labelAr: "صور السبب", labelEn: "Reason Photos", type: "image", bucketHint: BUCKETS.availability },
      { key: "place_photos", labelAr: "صور المكان", labelEn: "Place Photos", type: "image", bucketHint: BUCKETS.availability },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "place_id", labelAr: "المكان", labelEn: "Place" },
      { key: "category_id", labelAr: "الفئة", labelEn: "Category" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
     ],
  lookups: {
    // لو عندك user_id هنا أضفه برضه
    place_id: { table: "Markets", select: "id, branch, store, city", labelField: "branch" },
    category_id: { table: "Categories", select: "id, name_ar, name_en", labelField: "name_en" },
  },
},
  whcount: {
    titleAr: "المستودع",
    titleEn: "Warehouse Count",
    table: "whcount",
    select:
      "id, visit_id, item_name, quantity, is_available, warehouse_photos, item_photo, custom_reason, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "warehouse_photos", labelAr: "صور المستودع", labelEn: "Warehouse", type: "image", bucketHint: BUCKETS.whcount },
      { key: "item_name", labelAr: "العنصر", labelEn: "Item" },
      { key: "quantity", labelAr: "الكمية", labelEn: "Qty", type: "number" },
      { key: "item_photo", labelAr: "صورة العنصر", labelEn: "Item Photo", type: "image", bucketHint: BUCKETS.whcount },
      { key: "custom_reason", labelAr: "ملاحظات", labelEn: "Notes" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  damage_reports: {
    titleAr: "التوالف",
    titleEn: "Damage Reports",
    table: "damagereports",
    select:
      "id, visit_id, item_name, photos, expire_date, damaged_qty, near_expire_date, near_expire_qty, expire_qty, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photos", labelAr: "الصور", labelEn: "Photos", type: "image", bucketHint: BUCKETS.damage },
      { key: "item_name", labelAr: "العنصر", labelEn: "Item" },
      { key: "damaged_qty", labelAr: "تالف", labelEn: "Damaged", type: "number" },
      { key: "near_expire_date", labelAr: "قرب انتهاء", labelEn: "Near Exp.", type: "datetime" },
      { key: "near_expire_qty", labelAr: "كمية قرب انتهاء", labelEn: "Near Exp. Qty", type: "number" },
      { key: "expire_date", labelAr: "تاريخ الانتهاء", labelEn: "Expire Date", type: "datetime" },
      { key: "expire_qty", labelAr: "انتهى", labelEn: "Expired Qty", type: "number" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  sos_reports: {
    titleAr: "حصة الرف",
    titleEn: "Share of Shelf",
    table: "sos_reports",
    select: "id, visit_id, category_name_ar, category_name_en, percentage, photos, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photos", labelAr: "الصور", labelEn: "Photos", type: "image", bucketHint: BUCKETS.sos },
      { key: "category_name_ar", labelAr: "الفئة (عربي)", labelEn: "Category (AR)" },
      { key: "category_name_en", labelAr: "الفئة (إنجليزي)", labelEn: "Category (EN)" },
      { key: "percentage", labelAr: "النسبة %", labelEn: "Percent %", type: "number" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  competitor_activity: {
    titleAr: "نشاط المنافسين",
    titleEn: "Competitor Activity",
    table: "competitoractivities",
    select:
      "id, visit_id, product_name, old_price, new_price, notes, photos_before, photos_after, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photos_before", labelAr: "قبل", labelEn: "Before", type: "image", bucketHint: BUCKETS.competitor },
      { key: "photos_after", labelAr: "بعد", labelEn: "After", type: "image", bucketHint: BUCKETS.competitor },
      { key: "product_name", labelAr: "المنتج", labelEn: "Product" },
      { key: "old_price", labelAr: "قبل", labelEn: "Old Price", type: "number" },
      { key: "new_price", labelAr: "بعد", labelEn: "New Price", type: "number" },
      { key: "notes", labelAr: "ملاحظات", labelEn: "Notes" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  remarks: {
    titleAr: "ملاحظات",
    titleEn: "Remarks",
    table: "remarks",
    // انت قلت العمود submit_at
    select: "id, visit_id, remark, user_id, submit_at",
    defaultOrder: { column: "submit_at", ascending: false },
    columns: [
      { key: "remark", labelAr: "الملاحظة", labelEn: "Remark" },
      { key: "user_id", labelAr: "المستخدم", labelEn: "User" },
      { key: "submit_at", labelAr: "التاريخ", labelEn: "Submitted At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
    lookups: {
      user_id: { table: "Users", select: "id,name,arabic_name", labelField: "name" },
    },
  },

  promoter_reports: {
    titleAr: "تقارير المروج",
    titleEn: "Promoter Reports",
    table: "promoter_reports",
    select:
      "id, visit_id, customer_name, visit_count, refuse_count, buy_count, best_seller, image_urls, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "image_urls", labelAr: "الصور", labelEn: "Photos", type: "image", bucketHint: BUCKETS.promoter },
      { key: "customer_name", labelAr: "العميل", labelEn: "Customer" },
      { key: "visit_count", labelAr: "زيارات", labelEn: "Visits", type: "number" },
      { key: "refuse_count", labelAr: "رفض", labelEn: "Refused", type: "number" },
      { key: "buy_count", labelAr: "شراء", labelEn: "Bought", type: "number" },
      { key: "best_seller", labelAr: "الأكثر مبيعًا", labelEn: "Best seller" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  promoter_plus_reports: {
    titleAr: "أقسام الماسحين",
    titleEn: "Promoter+",
    table: "promoter_plus_reports",
    select: "id, visit_id, items, photos, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photos", labelAr: "الصور", labelEn: "Photos", type: "image", bucketHint: BUCKETS.promoterPlus },
      { key: "items", labelAr: "عناصر", labelEn: "Items" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
  },

  tl_details: {
    titleAr: "تفاصيل قائد الفريق",
    titleEn: "TL Details",
    table: "tlvisitdetails",
    select: "id, visit_id, user_id, photo_url, remark, created_at",
    defaultOrder: { column: "created_at", ascending: false },
    columns: [
      { key: "photo_url", labelAr: "الصورة", labelEn: "Photo", type: "image", bucketHint: BUCKETS.tl },
      { key: "remark", labelAr: "ملاحظة", labelEn: "Remark" },
      { key: "user_id", labelAr: "المستخدم", labelEn: "User" },
      { key: "created_at", labelAr: "التاريخ", labelEn: "Created At", type: "datetime" },
      { key: "visit_id", labelAr: "الزيارة", labelEn: "Visit" },
    ],
    lookups: {
      user_id: { table: "Users", select: "id,name,arabic_name", labelField: "name" },
    },
  },
};
