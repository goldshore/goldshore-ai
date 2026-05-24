import { Hono } from 'hono';
import { type Account } from '@goldshore/core-schema';

type Env = {
  DB: D1Database;
  // Note: in the future, we will transition DB connections to Postgres
  // for complex relational queries, but the API edge worker remains the same.
};

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  // In a real implementation, this would query the Postgres database
  // using Drizzle ORM and the schemas defined in @goldshore/core-schema

  const mockAccounts: Account[] = [
    {
      id: "uuid-1",
      broker: "tos",
      brokerAccountId: "12345",
      name: "Main Trading",
      type: "MARGIN",
      baseCurrency: "USD",
      isMarginEnabled: true,
      optionsLevel: 3,
      isCloseOnly: false,
      isPdtTracked: false,
      isIraRestricted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  return c.json({ accounts: mockAccounts });
});

app.get('/:id/positions', async (c) => {
  const accountId = c.req.param('id');

  // Return positions for the account using the core-schema types
  return c.json({
    accountId,
    positions: []
  });
});

export default app;
