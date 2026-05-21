import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  decimal,
  date,
  jsonb,
  index,
  unique
} from "drizzle-orm/pg-core";

// Accounts Table
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    broker: varchar("broker", { length: 20 }).notNull(), // 'tos', 'fidelity', 'robinhood'
    brokerAccountId: varchar("broker_account_id", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'INDIVIDUAL', 'IRA', etc.
    baseCurrency: varchar("base_currency", { length: 3 }).default("USD"),
    isMarginEnabled: boolean("is_margin_enabled").default(false),
    optionsLevel: integer("options_level"),
    isCloseOnly: boolean("is_close_only").default(false),
    isPdtTracked: boolean("is_pdt_tracked").default(false),
    isIraRestricted: boolean("is_ira_restricted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      brokerAccountIdUnique: unique("broker_account_id_unique").on(table.broker, table.brokerAccountId),
    };
  }
);

// Balance Snapshots for historical tracking
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    netLiquidationValue: decimal("net_liquidation_value", { precision: 18, scale: 4 }).notNull(),
    cashAvailable: decimal("cash_available", { precision: 18, scale: 4 }).notNull(),
    settledCash: decimal("settled_cash", { precision: 18, scale: 4 }).notNull(),
    buyingPower: decimal("buying_power", { precision: 18, scale: 4 }),
    maintenanceExcess: decimal("maintenance_excess", { precision: 18, scale: 4 }),
  },
  (table) => {
    return {
      accountTimeIdx: index("idx_balance_snapshots_account_time").on(table.accountId, table.timestamp),
    };
  }
);

// Instruments (Equities and Options)
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: varchar("symbol", { length: 20 }).notNull().unique(),
    assetType: varchar("asset_type", { length: 20 }).notNull(),
    underlyingSymbol: varchar("underlying_symbol", { length: 20 }),
    strikePrice: decimal("strike_price", { precision: 18, scale: 4 }),
    expirationDate: date("expiration_date"),
    optionType: varchar("option_type", { length: 10 }), // 'CALL' or 'PUT'
    multiplier: integer("multiplier").default(100),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

// Active Positions
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id").references(() => instruments.id),
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    averageOpenPrice: decimal("average_open_price", { precision: 18, scale: 4 }).notNull(),
    markPrice: decimal("mark_price", { precision: 18, scale: 4 }),
    marketValue: decimal("market_value", { precision: 18, scale: 4 }),
    dayPnl: decimal("day_pnl", { precision: 18, scale: 4 }),
    unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 4 }),
    // Real-time Greeks (stored as JSONB for flexibility)
    greeks: jsonb("greeks"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      accountInstrumentUnique: unique("account_instrument_unique").on(table.accountId, table.instrumentId),
      accountIdx: index("idx_positions_account").on(table.accountId),
    };
  }
);

// Orders Table
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id),
    brokerOrderId: varchar("broker_order_id", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull(), // 'FILLED', 'CANCELLED', etc.
    symbol: varchar("symbol", { length: 20 }).notNull(),
    side: varchar("side", { length: 10 }).notNull(), // 'BUY', 'SELL'
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    limitPrice: decimal("limit_price", { precision: 18, scale: 4 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    filledAt: timestamp("filled_at", { withTimezone: true }),
  }
);

// Individual Fills (executions)
export const fills = pgTable(
  "fills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    price: decimal("price", { precision: 18, scale: 4 }).notNull(),
    commission: decimal("commission", { precision: 18, scale: 4 }).default("0"),
    fees: decimal("fees", { precision: 18, scale: 4 }).default("0"),
  }
);

// Tax Lots (Fidelity-style tracking)
export const taxLots = pgTable(
  "tax_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id),
    instrumentId: uuid("instrument_id").references(() => instruments.id),
    fillId: uuid("fill_id").references(() => fills.id),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    quantityInitial: decimal("quantity_initial", { precision: 18, scale: 8 }).notNull(),
    quantityRemaining: decimal("quantity_remaining", { precision: 18, scale: 8 }).notNull(),
    costBasisPerShare: decimal("cost_basis_per_share", { precision: 18, scale: 4 }).notNull(),
  },
  (table) => {
    return {
      lookupIdx: index("idx_tax_lots_lookup").on(table.accountId, table.instrumentId),
    };
  }
);
