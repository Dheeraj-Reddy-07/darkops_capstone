import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { format } from 'date-fns';

export interface CustomerOrder {
  id: string;
  placedAt: string;
  storeName: string;
  storeId: string;
  items: number;
  total: number;
  status: "Delivered" | "Out for delivery" | "Packing" | "Refund in progress" | string;
  eta?: string;
  itemsPreview: string;
}

export function useCustomerOrders() {
  return useQuery({
    queryKey: ['customer-orders'],
    queryFn: async () => {
      const response = await fetchApi('/customers/me/orders');
      
      const orders: CustomerOrder[] = response.data.map((row: any) => ({
        id: row.id,
        placedAt: format(new Date(row.placed_at), "dd MMM, HH:mm 'IST'"),
        storeName: row.stores?.name || 'Local Store',
        storeId: row.store_id,
        items: row.item_count,
        total: row.total_amount_paise / 100,
        status: row.status === 'delivered' ? 'Delivered' : 
                row.status === 'out_for_delivery' ? 'Out for delivery' : 
                row.status === 'packing' ? 'Packing' : row.status,
        eta: row.eta_at ? format(new Date(row.eta_at), "HH:mm 'IST'") : undefined,
        itemsPreview: row.items_preview || 'Order items',
      }));
      return orders;
    },
    retry: false,
  });
}

export function useCustomerComplaints() {
  return useQuery({
    queryKey: ['customer-complaints'],
    queryFn: async () => {
      const response = await fetchApi('/customers/me/complaints');
      
      const complaints = response.data.map((row: any) => ({
        id: row.id,
        complaintRef: row.complaint_ref,
        orderId: row.order_id,
        summary: row.summary,
        detail: row.detail,
        category: row.category,
        status: row.status,
        priority: row.priority,
        createdAt: format(new Date(row.created_at), "dd MMM, HH:mm 'IST'"),
        resolution: row.resolution,
      }));
      return complaints;
    },
    retry: false,
  });
}

export function useSubmitComplaint() {
  return useMutation({
    mutationFn: async (data: { order_id: string; category: string; details: string }) => {
      return await fetchApi('/customers/me/complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
    },
  });
}
