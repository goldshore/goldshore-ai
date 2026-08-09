import type { PaperOrder, Quote } from '../types';

export interface FillResult {
  fillPrice: number;
  fillQty: number;
  partialFill: boolean;
  rejected: boolean;
  rejectReason?: string;
}

const SLIPPAGE = 0.001; // 0.1%

export function simulateFill(order: PaperOrder, quote: Quote): FillResult {
  const available = quote.ask > 0 && quote.bid > 0;

  if (!available) {
    return { fillPrice: 0, fillQty: 0, partialFill: false, rejected: true, rejectReason: 'No quote available' };
  }

  if (order.order_type === 'market') {
    const basePrice = order.side === 'buy' ? quote.ask : quote.bid;
    const slippage = order.side === 'buy' ? 1 + SLIPPAGE : 1 - SLIPPAGE;
    const fillPrice = parseFloat((basePrice * slippage).toFixed(2));
    return { fillPrice, fillQty: order.quantity, partialFill: false, rejected: false };
  }

  if (order.order_type === 'limit' && order.limit_price != null) {
    const canFill =
      order.side === 'buy' ? quote.ask <= order.limit_price : quote.bid >= order.limit_price;
    if (!canFill) {
      return { fillPrice: 0, fillQty: 0, partialFill: false, rejected: false };
    }
    const fillPrice = order.side === 'buy'
      ? Math.min(order.limit_price, quote.ask)
      : Math.max(order.limit_price, quote.bid);
    return { fillPrice, fillQty: order.quantity, partialFill: false, rejected: false };
  }

  if (order.order_type === 'stop' && order.limit_price != null) {
    const triggered =
      order.side === 'buy' ? quote.last >= order.limit_price : quote.last <= order.limit_price;
    if (!triggered) {
      return { fillPrice: 0, fillQty: 0, partialFill: false, rejected: false };
    }
    const basePrice = order.side === 'buy' ? quote.ask : quote.bid;
    const slippage = order.side === 'buy' ? 1 + SLIPPAGE : 1 - SLIPPAGE;
    const fillPrice = parseFloat((basePrice * slippage).toFixed(2));
    return { fillPrice, fillQty: order.quantity, partialFill: false, rejected: false };
  }

  return { fillPrice: 0, fillQty: 0, partialFill: false, rejected: true, rejectReason: 'Unknown order type' };
}
