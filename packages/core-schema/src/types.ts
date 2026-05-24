import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  accounts,
  balanceSnapshots,
  instruments,
  positions,
  orders,
  fills,
  taxLots,
} from "./db.ts";

// -- Canonical Type Exports (Drizzle Inferred) --

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type BalanceSnapshot = InferSelectModel<typeof balanceSnapshots>;
export type NewBalanceSnapshot = InferInsertModel<typeof balanceSnapshots>;

export type Instrument = InferSelectModel<typeof instruments>;
export type NewInstrument = InferInsertModel<typeof instruments>;

export type Position = InferSelectModel<typeof positions>;
export type NewPosition = InferInsertModel<typeof positions>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type Fill = InferSelectModel<typeof fills>;
export type NewFill = InferInsertModel<typeof fills>;

export type TaxLot = InferSelectModel<typeof taxLots>;
export type NewTaxLot = InferInsertModel<typeof taxLots>;

// -- Custom Types / Enums --

export type BrokerType = "tos" | "fidelity" | "robinhood";
export type AccountType = "INDIVIDUAL" | "IRA" | "ROTH_IRA" | "CASH" | "MARGIN";
export type AssetType = "equity" | "option" | "etf";
export type OptionType = "CALL" | "PUT";
export type OrderStatus = "FILLED" | "CANCELLED" | "PENDING" | "REJECTED" | "NEW" | "QUEUED" | "PARTIAL";
export type OrderSide = "BUY" | "SELL";

export interface OptionGreeks {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  impliedVolatility?: number;
}
