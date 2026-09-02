export interface CustomerOrder {
  id: string;
  placedAt: string;
  storeName: string;
  storeId: string;
  items: number;
  total: number;
  status: "Delivered" | "Out for delivery" | "Packing" | "Refund in progress";
  eta?: string;
  itemsPreview: string;
}

export const CUSTOMER = {
  name: "Aditya Menon",
  id: "CU-771204",
  city: "Bengaluru",
  address: "Flat 1204, Brigade Enclave, Ring Road, Bengaluru 560103",
};

export const CUSTOMER_ORDERS: CustomerOrder[] = [
  {
    id: "ORD-884213",
    placedAt: "Today, 20:52 IST",
    storeName: "Bengaluru Ring Road DS",
    storeId: "DS-1525",
    items: 9,
    total: 1840,
    status: "Out for delivery",
    eta: "21:48 IST",
    itemsPreview: "Toned milk 1L, Brown eggs ×12, Amul butter 500g +6 more",
  },
  {
    id: "ORD-883940",
    placedAt: "Today, 13:16 IST",
    storeName: "Bengaluru Ring Road DS",
    storeId: "DS-1525",
    items: 4,
    total: 620,
    status: "Refund in progress",
    itemsPreview: "Vanilla ice cream 1L, Frozen peas 500g, Curd 400g +1 more",
  },
  {
    id: "ORD-882117",
    placedAt: "28 Aug, 19:04 IST",
    storeName: "Bengaluru South DS",
    storeId: "DS-1105",
    items: 12,
    total: 2470,
    status: "Delivered",
    itemsPreview: "Atta 5kg, Basmati rice 5kg, Cooking oil 1L +9 more",
  },
  {
    id: "ORD-879654",
    placedAt: "26 Aug, 09:31 IST",
    storeName: "Bengaluru Ring Road DS",
    storeId: "DS-1525",
    items: 6,
    total: 910,
    status: "Delivered",
    itemsPreview: "Bananas 1kg, Paneer 200g, Bread loaf +3 more",
  },
];

export const ACTIVE_ISSUE = {
  complaintId: "CMP-482137",
  caseId: "CS-4101",
  orderId: "ORD-883940",
  title: "Melted frozen goods on arrival",
  raisedAt: "Today, 13:52 IST",
  status: "Under review",
  stage: 3,
  refundAmount: 410,
  stages: ["Complaint received", "Evidence verified", "Under review", "Decision", "Refund settled"],
};

export const ISSUE_CATEGORIES = [
  { key: "wrong-item", label: "Wrong item", hint: "You received something you did not order" },
  { key: "missing-item", label: "Missing item", hint: "Part of your order did not arrive" },
  { key: "late-delivery", label: "Late delivery", hint: "The order arrived after the promised time" },
  { key: "damaged-item", label: "Damaged item", hint: "Packaging or contents were damaged" },
  { key: "quality-issue", label: "Quality issue", hint: "Spoiled, expired or thawed product" },
  { key: "payment-issue", label: "Payment issue", hint: "Charge, refund or wallet problem" },
  { key: "other", label: "Other", hint: "Something else about this order" },
];

export const TRACKING_STEPS = [
  { label: "Order placed", at: "20:52 IST", done: true },
  { label: "Picked at dark store", at: "21:04 IST", done: true },
  { label: "Packed & quality checked", at: "21:11 IST", done: true },
  { label: "Out for delivery", at: "21:19 IST", done: true },
  { label: "Delivered", at: "ETA 21:48 IST", done: false },
];

export const REFUND_REQUESTS = [
  {
    id: "RFD-33218",
    orderId: "ORD-883940",
    amount: 410,
    reason: "Melted frozen goods",
    status: "Under review" as const,
    raised: "Today, 13:52 IST",
  },
  {
    id: "RFD-32874",
    orderId: "ORD-879654",
    amount: 120,
    reason: "Missing item - paneer 200g",
    status: "Settled" as const,
    raised: "26 Aug, 10:22 IST",
  },
];
