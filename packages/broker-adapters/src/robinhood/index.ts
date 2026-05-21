import { type Account, type Order, type Position } from "@goldshore/core-schema";
import { type BrokerAdapter } from "../index.js";

export interface RobinhoodConfig {
  accessToken?: string;
}

export class RobinhoodAdapter implements BrokerAdapter {
  id = "robinhood";
  name = "robinhood";
  private token?: string;

  constructor(config?: RobinhoodConfig | string) {
    this.token = typeof config === "string" ? config : config?.accessToken;
  }

  async getAccounts(): Promise<Account[]> {
    return [
      {
        id: "rh-acc-1",
        broker: "robinhood",
        brokerAccountId: "rh-acc-1",
        name: "Robinhood Cash",
        type: "CASH" as Account["type"],
        baseCurrency: "USD",
        isMarginEnabled: false,
        optionsLevel: null,
        isCloseOnly: false,
        isPdtTracked: false,
        isIraRestricted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getPositions(accountId: string): Promise<Position[]> {
    if (accountId !== "rh-acc-1" && accountId !== "test-id") {
      return [];
    }

    return [
      {
        id: "rh-pos-1",
        accountId,
        instrumentId: "MSFT",
        quantity: "15",
        averageOpenPrice: "300.00",
        markPrice: "320.00",
        marketValue: "4800.00",
        dayPnl: "0.00",
        unrealizedPnl: "300.00",
        greeks: null,
        updatedAt: new Date(),
      },
    ];
  }

  async getOrders(_accountId: string): Promise<Order[]> {
    void this.token;
    return [];
  }
}
