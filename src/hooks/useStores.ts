import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export type StoreStatus = "critical" | "at-risk" | "healthy";

export interface PulseBreakdown {
  equipment: number;
  sla: number;
  refunds: number;
  delivery: number;
  picker: number;
  inventory: number;
}

export interface DarkStore {
  id: string;
  name: string;
  city: string;
  zone: string;
  manager: string;
  pulse: number;
  prevPulse: number;
  sla: number;
  refundRate: number;
  avgResolutionMins: number;
  openIssues: number;
  status: StoreStatus;
  pickers: number;
  riders: number;
  equipmentFailures14d: number;
  inventoryIssues: number;
  deliveryDelays: number;
  pickerDelayMins: number;
  breakdown: PulseBreakdown;
}

function statusFor(pulse: number): StoreStatus {
  if (pulse < 60) return "critical";
  if (pulse < 80) return "at-risk";
  return "healthy";
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await fetchApi('/stores?limit=200');
      
      const stores: DarkStore[] = response.data.map((row: any) => {
        const pulse = row.pulse || 0;
        const pulseData = row.pulse_scores || {};
        
        const breakdown: PulseBreakdown = {
          equipment: pulseData.equipment_pts || 0,
          sla: pulseData.sla_pts || 0,
          refunds: pulseData.refunds_pts || 0,
          delivery: pulseData.delivery_pts || 0,
          picker: pulseData.picker_pts || 0,
          inventory: pulseData.inventory_pts || 0,
        };

        return {
          id: row.id,
          name: row.name,
          city: row.city,
          zone: row.zone,
          manager: row.manager_name || 'Manager',
          pulse,
          prevPulse: pulse,
          sla: row.metrics?.sla_pct || 0,
          refundRate: row.metrics?.refund_rate_pct || 0,
          avgResolutionMins: row.metrics?.avg_resolution_mins || 0,
          openIssues: row.metrics?.open_issues || 0,
          status: statusFor(pulse),
          pickers: row.pickers_on_shift || 12,
          riders: row.riders_assigned || 8,
          equipmentFailures14d: row.metrics?.equipment_failures_14d || 0,
          inventoryIssues: row.metrics?.inventory_issues || 0,
          deliveryDelays: row.metrics?.delivery_delays || 0,
          pickerDelayMins: row.metrics?.picker_delay_mins || 0,
          breakdown,
        };
      });

      const avgPulse = Math.round(stores.reduce((a, s) => a + s.pulse, 0) / Math.max(1, stores.length));
      const criticalStores = stores.filter((s) => s.status === "critical").length;
      const avgSla = (stores.reduce((a, s) => a + s.sla, 0) / Math.max(1, stores.length)).toFixed(1);
      const avgRefundRate = (stores.reduce((a, s) => a + s.refundRate, 0) / Math.max(1, stores.length)).toFixed(1);
      const avgResolution = Math.round(stores.reduce((a, s) => a + s.avgResolutionMins, 0) / Math.max(1, stores.length));

      const worstStores = [...stores].sort((a, b) => a.pulse - b.pulse).slice(0, 5);

      return {
        stores,
        kpis: {
          storeCount: stores.length,
          cityCount: new Set(stores.map(s => s.city)).size,
          avgPulse,
          criticalStores,
          avgSla,
          avgRefundRate,
          avgResolution,
        },
        worstStores,
      };
    },
  });
}
