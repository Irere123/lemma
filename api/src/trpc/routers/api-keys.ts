import { deleteApiKey, getApiKeysByUser, upsertApiKey } from "@api/db/queries";
import { createTRPCRouter, protectedProcedure } from "../init";
import { deleteApiKeySchema, upsertApiKeySchema } from "@api/schemas";

export const apiKeysRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { db, user } }) => {
    return getApiKeysByUser(db, user.id);
  }),

  upsert: protectedProcedure
    .input(upsertApiKeySchema)
    .mutation(async ({ ctx: { db, user }, input }) => {
      const { data, key, keyHash } = await upsertApiKey(db, {
        userId: user.id,
        ...input,
      });

      // TODO: Invalidate cache if this was an update (has keyHash)

      // TODO: send email for notification

      return {
        key,
        data,
      };
    }),
  delete: protectedProcedure
    .input(deleteApiKeySchema)
    .mutation(async ({ ctx: { db }, input }) => {
      const keyHash = await deleteApiKey(db, input);

      // TODO: Invalidate cache if key was deleted

      return keyHash;
    }),
});
