import { defineCollection, z } from 'astro:content';
<<<<<<< HEAD

export const collections = {
  docs: defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      order: z.number().optional(),
    }),
  }),
};
=======
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.date().optional(),
    order: z.number().optional()
  })
});

export const collections = { docs };
>>>>>>> origin/main
