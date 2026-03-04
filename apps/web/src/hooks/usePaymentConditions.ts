import { useState, useCallback } from "react";
import { api } from "../services/api";


export interface PaymentConditionInstallment {
  id?: string;
  installment: number;
  days: number;
  percentage: number;
}

export interface PaymentCondition {
  id: string;
  code: number;
  name: string;
  surcharge: number;
  discount: number;
  active: boolean;
  installments?: PaymentConditionInstallment[];
}

export function usePaymentConditions() {
  const [conditions, setConditions] = useState<PaymentCondition[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payment-conditions");
      setConditions(data || []);
    } catch (error) {
      console.error("Error fetching payment conditions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCondition = async (
    conditionData: Omit<PaymentCondition, "id" | "code">,
  ) => {
    try {
      await api.post("/payment-conditions", conditionData);
      await fetchConditions();
    } catch (error) {
      console.error("Error creating payment condition:", error);
      throw error;
    }
  };

  const updateCondition = async (
    id: string,
    conditionData: Partial<PaymentCondition>,
  ) => {
    try {
      await api.patch(`/payment-conditions/${id}`, conditionData);
      await fetchConditions();
    } catch (error) {
      console.error("Error updating payment condition:", error);
      throw error;
    }
  };

  const deleteCondition = async (id: string) => {
    try {
      await api.delete(`/payment-conditions/${id}`);
      await fetchConditions();
    } catch (error) {
      console.error("Error deleting payment condition:", error);
      throw error;
    }
  };

  return {
    conditions,
    loading,
    fetchConditions,
    createCondition,
    updateCondition,
    deleteCondition,
  };
}
