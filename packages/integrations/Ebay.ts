import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface EbayListing {
  sku: string;
  offerId?: string;
  listingId?: string;
  title: string;
  quantity: number;
  price: number;
  currency: string;
  status: 'draft' | 'published' | 'ended' | 'unpublished';
}

export interface EbayOrder {
  orderId: string;
  buyerUsername?: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface EbayMetrics {
  activeListings: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

/**
 * eBay Sell APIs (Inventory + Fulfillment) for full listing management —
 * create/edit/relist items and read orders. Config: apiKey = App ID
 * (Client ID), apiSecret = the current user access token obtained through
 * the /oauth/ebay authorization-code flow (see
 * apps/gs-api/src/routes/oauth/ebay.ts). This class does not perform the
 * OAuth dance itself — it only consumes a token that's already been issued
 * and refreshed by that route.
 */
export class EbayIntegration extends BaseIntegration {
  private clientId: string;
  private accessToken: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.clientId = config.apiKey || '';
    this.accessToken = config.apiSecret || '';
  }

  private get apiBase(): string {
    return this.config.metadata?.sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
      ...extra,
    };
  }

  async authenticate(): Promise<boolean> {
    if (!this.accessToken) {
      this.config.status = 'disconnected';
      return false;
    }

    try {
      // Lightweight authenticated call to confirm the token is live.
      const response = await fetch(`${this.apiBase}/sell/account/v1/privilege`, {
        headers: this.headers(),
      });

      this.config.status = response.ok ? 'connected' : 'error';
      if (!response.ok) this.config.error = `Token check failed: ${response.status}`;
      return response.ok;
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return false;
    }
  }

  /**
   * List inventory items (the SKU-level records behind live/draft listings).
   */
  async getListings(limit: number = 100): Promise<EbayListing[]> {
    try {
      const response = await fetch(`${this.apiBase}/sell/inventory/v1/inventory_item?limit=${limit}`, {
        headers: this.headers(),
      });

      if (!response.ok) throw new Error('Failed to fetch eBay inventory items');

      const data = await response.json() as any;
      return (data.inventoryItems || []).map((item: any) => ({
        sku: item.sku,
        title: item.product?.title ?? '',
        quantity: item.availability?.shipToLocationAvailability?.quantity ?? 0,
        price: 0, // price lives on the offer, not the inventory item — see getOffer
        currency: 'USD',
        status: 'draft',
      }));
    } catch (error) {
      console.error('Error fetching eBay listings:', error);
      return [];
    }
  }

  /**
   * Create or update the inventory record for a SKU. eBay's Inventory API
   * is PUT/idempotent — the same call creates or edits.
   */
  async upsertInventoryItem(sku: string, item: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(item),
      });

      return response.ok;
    } catch (error) {
      console.error('Error upserting eBay inventory item:', error);
      return false;
    }
  }

  /**
   * Create the sale offer (price, quantity, listing policies) for a SKU
   * that already has an inventory item.
   */
  async createOffer(sku: string, offer: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiBase}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ sku, ...offer }),
      });

      if (!response.ok) return null;
      const data = await response.json() as { offerId: string };
      return data.offerId;
    } catch (error) {
      console.error('Error creating eBay offer:', error);
      return null;
    }
  }

  /**
   * Publish an offer, turning it into a live listing (or relisting it).
   */
  async publishOffer(offerId: string): Promise<{ listingId?: string; ok: boolean }> {
    try {
      const response = await fetch(`${this.apiBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, {
        method: 'POST',
        headers: this.headers(),
      });

      if (!response.ok) return { ok: false };
      const data = await response.json() as { listingId?: string };
      return { ok: true, listingId: data.listingId };
    } catch (error) {
      console.error('Error publishing eBay offer:', error);
      return { ok: false };
    }
  }

  /**
   * End a live listing by withdrawing its offer.
   */
  async endListing(offerId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {
        method: 'POST',
        headers: this.headers(),
      });

      return response.ok;
    } catch (error) {
      console.error('Error ending eBay listing:', error);
      return false;
    }
  }

  /**
   * Fetch recent orders for sales management.
   */
  async getOrders(limit: number = 50): Promise<EbayOrder[]> {
    try {
      const response = await fetch(`${this.apiBase}/sell/fulfillment/v1/order?limit=${limit}`, {
        headers: this.headers(),
      });

      if (!response.ok) throw new Error('Failed to fetch eBay orders');

      const data = await response.json() as any;
      return (data.orders || []).map((o: any) => ({
        orderId: o.orderId,
        buyerUsername: o.buyer?.username,
        total: parseFloat(o.pricingSummary?.total?.value ?? '0'),
        currency: o.pricingSummary?.total?.currency ?? 'USD',
        status: o.orderFulfillmentStatus ?? 'UNKNOWN',
        createdAt: o.creationDate,
      }));
    } catch (error) {
      console.error('Error fetching eBay orders:', error);
      return [];
    }
  }

  async calculateMetrics(): Promise<EbayMetrics> {
    try {
      const [listings, orders] = await Promise.all([this.getListings(200), this.getOrders(200)]);
      const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

      return {
        activeListings: listings.length,
        totalOrders: orders.length,
        totalRevenue,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      };
    } catch (error) {
      console.error('Error calculating eBay metrics:', error);
      return { activeListings: 0, totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 };
    }
  }

  async sync(): Promise<Record<string, unknown>> {
    try {
      const metrics = await this.calculateMetrics();

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        metrics,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle eBay platform notifications (order created, item sold, the
   * mandatory Marketplace Account Deletion notice, etc.).
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const eventType = (event.metadata as any)?.topic ?? (event.notificationEventName as string);

    switch (eventType) {
      case 'ITEM_SOLD':
      case 'ORDER_CREATED':
      case 'MARKETPLACE_ACCOUNT_DELETION':
        await this.logEvent(String(eventType), event, {} as any);
        break;
    }
  }
}
