import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { format } from "date-fns";

export interface CustomerProfileData {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  created_at: string;
}

export function useCustomerProfile() {
  return useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const response = await fetchApi("/customers/me/profile");
      return response.data as CustomerProfileData;
    },
    retry: false,
  });
}

export interface CustomerOrder {
  id: string;
  placedAt: string;
  storeName: string;
  storeId: string;
  storeCity?: string | undefined;
  items: number;
  total: number;
  status: "Delivered" | "Out for delivery" | "Packing" | "Refund in progress" | string;
  eta?: string | undefined;
  itemsPreview: string;
  deliveredAt?: string | undefined;
  deliveryPartner?: string | undefined;
}

export interface OrderDetail extends CustomerOrder {
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export function useCustomerOrders(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["customer-orders"],
    queryFn: async () => {
      const response = await fetchApi("/customers/me/orders");

      const orders: CustomerOrder[] = response.data.map((row: any) => ({
        id: row.id,
        placedAt: format(new Date(row.placed_at), "dd MMM, HH:mm 'IST'"),
        storeName: row.store_name || "Local Store",
        storeId: row.store_id,
        storeCity: row.store_city,
        items: row.item_count,
        total: row.total_amount_paise / 100,
        status:
          row.status === "delivered"
            ? "Delivered"
            : row.status === "out_for_delivery"
              ? "Out for delivery"
              : row.status === "packing"
                ? "Packing"
                : row.status,
        eta: row.eta_at ? format(new Date(row.eta_at), "HH:mm 'IST'") : undefined,
        itemsPreview:
          row.order_items?.map((i: any) => i.name).join(", ") || row.items_preview || "Order items",
        deliveredAt: row.delivered_at
          ? format(new Date(row.delivered_at), "dd MMM, HH:mm 'IST'")
          : undefined,
        deliveryPartner: row.delivery_partner,
      }));
      return orders;
    },
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useCustomerOrderById(orderId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: async () => {
      const response = await fetchApi(`/customers/me/orders/${orderId}`);

      const order: OrderDetail = {
        id: response.data.id,
        placedAt: format(new Date(response.data.placed_at), "dd MMM, HH:mm 'IST'"),
        storeName: response.data.store_name || "Local Store",
        storeId: response.data.store_id,
        storeCity: response.data.store_city,
        items: response.data.item_count,
        total: response.data.total_amount_paise / 100,
        status:
          response.data.status === "delivered"
            ? "Delivered"
            : response.data.status === "out_for_delivery"
              ? "Out for delivery"
              : response.data.status === "packing"
                ? "Packing"
                : response.data.status,
        eta: response.data.eta_at
          ? format(new Date(response.data.eta_at), "HH:mm 'IST'")
          : undefined,
        itemsPreview:
          response.data.order_items?.map((item: any) => item.name).join(", ") ||
          response.data.items_preview ||
          "Order items",
        deliveredAt: response.data.delivered_at
          ? format(new Date(response.data.delivered_at), "dd MMM, HH:mm 'IST'")
          : undefined,
        deliveryPartner: response.data.delivery_partner,
        orderItems:
          response.data.order_items?.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unit_price_paise / 100,
          })) || [],
      };
      return order;
    },
    enabled: !!orderId && (options?.enabled ?? true),
    retry: false,
  });
}

export interface CustomerComplaint {
  id: string;
  complaintRef: string;
  orderId: string;
  summary: string;
  detail: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  resolution?: string | undefined;
  automationResult?: string | undefined;
  storeName?: string | undefined;
  orderValue?: number | undefined;
  slaBreached?: boolean | undefined;
  isLiveCallEligible?: boolean | undefined;
  slaDueAt?: string | undefined;
  slaDueIso?: string | undefined;
  rawCreatedAt?: string | undefined;
  rawUpdatedAt?: string | undefined;
  /** Backend-computed customer-facing status label (reflects real automation outcome) */
  customerStatusLabel?: string | undefined;
  /** Backend-computed customer-facing status detail text */
  customerStatusDetail?: string | undefined;
}

export interface ComplaintDetail extends CustomerComplaint {
  orderItemCount?: number | undefined;
  attachments?:
    | Array<{
        id: string;
        filename: string;
        fileType: string;
        uploadedAt: string;
      }>
    | undefined;
  statusHistory?:
    | Array<{
        fromStatus: string;
        toStatus: string;
        changedAt: string;
        note?: string;
      }>
    | undefined;
}

export function useCustomerComplaints() {
  return useQuery({
    queryKey: ["customer-complaints"],
    queryFn: async () => {
      const response = await fetchApi("/customers/me/complaints");

      const complaints: CustomerComplaint[] = response.data.map((row: any) => ({
        id: row.id,
        complaintRef: row.complaint_ref,
        orderId: row.order_id,
        summary: row.summary,
        detail: row.detail,
        category: row.category,
        status: row.status,
        priority: row.priority,
        createdAt: format(new Date(row.created_at), "dd MMM, HH:mm 'IST'"),
        rawCreatedAt: row.created_at || undefined,
        rawUpdatedAt: row.updated_at || undefined,
        resolution: row.resolution,
        automationResult: row.automation_result,
        storeName: row.store_name,
        slaBreached: row.sla_breached,
        isLiveCallEligible: row.is_live_call_eligible,
        slaDueAt: row.sla_due_at ? format(new Date(row.sla_due_at), "HH:mm 'IST'") : undefined,
        slaDueIso: row.sla_due_at || undefined,
        customerStatusLabel: row.customer_status_label,
        customerStatusDetail: row.customer_status_detail,
      }));
      return complaints;
    },
    retry: false,
  });
}

export function useCustomerComplaintById(complaintId: string) {
  return useQuery({
    queryKey: ["customer-complaint", complaintId],
    queryFn: async () => {
      const response = await fetchApi(`/customers/me/complaints/${complaintId}`);

      const complaint: ComplaintDetail = {
        id: response.data.id,
        complaintRef: response.data.complaint_ref,
        orderId: response.data.order_id,
        summary: response.data.summary,
        detail: response.data.detail,
        category: response.data.category,
        status: response.data.status,
        priority: response.data.priority,
        createdAt: format(new Date(response.data.created_at), "dd MMM, HH:mm 'IST'"),
        resolution: response.data.resolution,
        automationResult: response.data.automation_result,
        storeName: response.data.store_name,
        slaBreached: response.data.sla_breached,
        isLiveCallEligible: response.data.is_live_call_eligible,
        slaDueAt: response.data.sla_due_at
          ? format(new Date(response.data.sla_due_at), "HH:mm 'IST'")
          : undefined,
        slaDueIso: response.data.sla_due_at || undefined,
        customerStatusLabel: response.data.customer_status_label,
        customerStatusDetail: response.data.customer_status_detail,
        orderValue: response.data.order_value_paise
          ? response.data.order_value_paise / 100
          : undefined,
        orderItemCount: response.data.order_value_paise ? undefined : undefined,
        attachments:
          response.data.attachments?.map((att: any) => ({
            id: att.id,
            filename: att.filename,
            fileType: att.file_type,
            uploadedAt: format(new Date(att.uploaded_at), "dd MMM, HH:mm 'IST'"),
          })) || [],
        statusHistory:
          response.data.status_history?.map((h: any) => ({
            fromStatus: h.from_status,
            toStatus: h.to_status,
            changedAt: format(new Date(h.changed_at), "dd MMM, HH:mm 'IST'"),
            note: h.note,
          })) || [],
      };
      return complaint;
    },
    enabled: !!complaintId,
    retry: false,
  });
}

export function useSubmitComplaint() {
  return useMutation({
    mutationFn: async (data: {
      order_id: string;
      category: string;
      details: string;
      attachments?: any[];
    }) => {
      return await fetchApi("/customers/me/complaints", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
  });
}

export function useRequestHumanSupport() {
  return useMutation({
    mutationFn: async (data: { complaint_id: string }) => {
      return await fetchApi("/customers/me/request-support", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-complaints"] });
    },
  });
}

export function useUploadAttachmentUrl() {
  return useMutation({
    mutationFn: async (data: { filename: string; content_type: string }) => {
      return await fetchApi("/customers/me/upload-url", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  });
}
