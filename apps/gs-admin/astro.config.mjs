import { createAstroConfig } from '@goldshore/config/astro';

export default createAstroConfig({
  site: 'https://admin.goldshore.ai',
  vite: {
    ssr: {
      noExternal: ['@goldshore/schema', '@goldshore/integrations', '@goldshore/utils'],
    },
  },
});
