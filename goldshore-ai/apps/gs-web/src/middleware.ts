import { onRequest as baseMiddleware } from "@goldshore/config/middleware";
import { defineMiddleware, sequence } from "astro:middleware";

// Specific web middleware logic if needed
const webMiddleware = defineMiddleware(async (context, next) => {
  return next();
});

export const onRequest = sequence(baseMiddleware, webMiddleware);
