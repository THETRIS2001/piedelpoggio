import { defineCollection, z } from 'astro:content';

// Schema per le pagine statiche
const pagesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  pages: pagesCollection,
};