import { z } from "zod";

export const TosAccountSchema = z.object({
  securitiesAccount: z.object({
    type: z.string(),
    accountId: z.string(),
    roundTrips: z.number().optional(),
    isDayTrader: z.boolean().optional(),
    isClosingOnlyRestricted: z.boolean().optional(),
    positions: z.array(z.object({
      shortQuantity: z.number(),
      averagePrice: z.number(),
      currentDayProfitLoss: z.number().optional(),
      currentDayProfitLossPercentage: z.number().optional(),
      longQuantity: z.number(),
      settledLongQuantity: z.number().optional(),
      settledShortQuantity: z.number().optional(),
      instrument: z.object({
        symbol: z.string(),
        assetType: z.string(),
        cusip: z.string().optional(),
      }),
      marketValue: z.number().optional(),
    })).optional(),
  })
});

export const TosAccountsResponseSchema = z.array(TosAccountSchema);

export const TosOrderSchema = z.object({
  orderId: z.number(),
  status: z.string(),
  enteredTime: z.string(),
  quantity: z.number(),
  orderLegCollection: z.array(z.object({
    instruction: z.string(),
    instrument: z.object({
      symbol: z.string(),
      assetType: z.string(),
    })
  }))
});

export const TosOrdersResponseSchema = z.array(TosOrderSchema);
