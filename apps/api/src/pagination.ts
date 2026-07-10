import { z } from "zod";

function optionalNumberParam(defaultValue: number) {
  return z
    .preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().optional(),
    )
    .transform((value) => value ?? defaultValue);
}

export function getPaginationQuerySchema(options: {
  defaultLimit: number;
  maxLimit: number;
}) {
  return z
    .object({
      limit: optionalNumberParam(options.defaultLimit).pipe(
        z.number().int().min(1).max(options.maxLimit),
      ),
      offset: optionalNumberParam(0).pipe(z.number().int().min(0)),
    })
    .strict();
}

export function getPaginatedResponse<T>(
  items: T[],
  limit: number,
  offset: number,
) {
  const hasMore = items.length > limit;

  return {
    items: hasMore ? items.slice(0, limit) : items,
    pagination: {
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : null,
    },
  };
}
