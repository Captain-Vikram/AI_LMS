import { useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import { API_ENDPOINTS } from "../config/api";

export const usePrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchUserRelatedData = () => {
    // Fire and forget
    setTimeout(() => {
      // Prefetch User Profile
      queryClient.prefetchQuery({
        queryKey: ["userProfile"],
        queryFn: async () => {
          const data = await apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE);
          return data;
        },
      });

      // Prefetch Classrooms list
      queryClient.prefetchQuery({
        queryKey: ["classrooms"],
        queryFn: async () => {
          const data = await apiClient.get(API_ENDPOINTS.CLASSROOM_LIST);
          return data.classrooms || data;
        },
      });
      
      // Prefetch Login Activity
      queryClient.prefetchQuery({
        queryKey: ["loginActivity"],
        queryFn: async () => {
          const data = await apiClient.get(API_ENDPOINTS.AUTH_LOGIN_ACTIVITY);
          return data;
        }
      });
      
    }, 100); // Slight delay to let login UI transition
  };

  return { prefetchUserRelatedData };
};
