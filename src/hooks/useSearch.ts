import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { stores: [], cases: [], fraud: [] };
      }
      return fetchApi(`/search?q=${encodeURIComponent(query)}`);
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 60,
  });
}
