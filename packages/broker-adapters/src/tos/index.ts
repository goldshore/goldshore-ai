import type { Account, Position, Order } from "@goldshore/core-schema";
import type { BrokerAdapter } from "../index.ts";
import { createHttpClient, type HttpClient } from "@goldshore/integrations/http.js";
import { TosAccountsResponseSchema } from "./schema.ts";

export class TOSAdapter implements BrokerAdapter {
  id = "tos";
  name = "thinkorswim";
  private client: HttpClient;

  constructor(config?: { apiKey?: string; accessToken?: string; baseUrl?: string }) {
    this.client = createHttpClient({
      baseUrl: config?.baseUrl || "https://api.tdameritrade.com/v1",
      authTokenManager: config?.accessToken
        ? { getToken: async () => config.accessToken! }
        : undefined,
      headers: {
        Authorization: config?.accessToken ? `Bearer ${config.accessToken}` : undefined,
      } as Record<string, string | undefined>,
    });
  }

  async getAccounts(): Promise<Account[]> {
    try {
      const response = await this.client.get("/accounts");
      if (response.status !== 200) return [];
      const raw = await response.json();
      const result = TosAccountsResponseSchema.safeParse(raw);
      if (!result.success) return [];

      return result.data.map(
        (acc) =>
          ({
            id: acc.securitiesAccount.accountId,
            broker: "tos" as const,
            brokerAccountId: acc.securitiesAccount.accountId,
            name: acc.securitiesAccount.accountId,
            type: acc.securitiesAccount.type as any,
            baseCurrency: "USD",
            isMarginEnabled: acc.securitiesAccount.type === "MARGIN",
            updatedAt: new Date(),
          }) as Account,
      );
    } catch {
      return [];
    }
  }

  async getPositions(accountId: string): Promise<Position[]> {
    try {
      const response = await this.client.get(`/accounts/${accountId}?fields=positions`);
      if (response.status !== 200) return [];
      const data = (await response.json()) as any;
      const positions = data.securitiesAccount.positions || [];
      return positions.map((p: any): Position => {
        const quantity = p.longQuantity || -p.shortQuantity || 0;
        return {
          id: `${accountId}-${p.instrument.symbol}`,
          accountId,
          quantity: quantity.toString(),
          averageOpenPrice: p.averagePrice.toString(),
          updatedAt: new Date(),
        };
      });
    } catch {
      return [];
    }
  }

  async getOrders(accountId: string): Promise<Order[]> {
    try {
      const response = await this.client.get(`/accounts/${accountId}/orders`);
      if (response.status !== 200) return [];
      const data = (await response.json()) as any[];
      return data.map(
        (o: any) =>
          ({
            id: o.orderId.toString(),
            accountId,
            brokerOrderId: o.orderId.toString(),
            status: o.status,
            symbol: o.orderLegCollection[0].instrument.symbol,
            side: o.orderLegCollection[0].instruction,
            quantity: o.quantity.toString(),
            submittedAt: new Date(o.enteredTime),
          }) as Order,
      );
    } catch {
      return [];
    }
  }
}
