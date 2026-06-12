import { useQuery } from "@tanstack/react-query";

import { listRestaurants } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useAuthStore } from "@/store";

export function useOwnedRestaurant() {
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: queryKeys.restaurants({ owned: true }),
    queryFn: () => listRestaurants({ page_size: 10 }),
    enabled: user?.role === "RESTAURANT_ADMIN",
  });

  return {
    ...query,
    restaurant: query.data?.results[0] ?? null,
    isRestaurantAdmin: user?.role === "RESTAURANT_ADMIN",
  };
}
