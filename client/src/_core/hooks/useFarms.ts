import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook para obter a fazenda ativa do usuário
 * Retorna a primeira fazenda disponível ou null
 */
export function useFarms() {
  const farmsQuery = trpc.farms.list.useQuery();

  const state = useMemo(() => {
    const farms = farmsQuery.data ?? [];
    const activeFarm = farms.length > 0 ? farms[0] : null;

    return {
      farms,
      activeFarm,
      loading: farmsQuery.isLoading,
      error: farmsQuery.error,
    };
  }, [farmsQuery.data, farmsQuery.isLoading, farmsQuery.error]);

  return state;
}
