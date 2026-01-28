import { z } from 'zod';
import type { Prisma } from '@prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const UserScalarFieldEnumSchema = z.enum(['id','email','phone','password','tier','createdAt','updatedAt']);

export const CounterScalarFieldEnumSchema = z.enum(['id','title','count','color','type','userId','createdAt','updatedAt']);

export const IdempotencyLogScalarFieldEnumSchema = z.enum(['key','userId','createdAt']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);

export const UserTierSchema = z.enum(['PREMIUM','BASIC']);

export type UserTierType = `${z.infer<typeof UserTierSchema>}`

export const CounterTypeSchema = z.enum(['PERSONAL','SHARED']);

export type CounterTypeType = `${z.infer<typeof CounterTypeSchema>}`

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  tier: UserTierSchema,
  id: z.uuid(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  password: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// COUNTER SCHEMA
/////////////////////////////////////////

export const CounterSchema = z.object({
  type: CounterTypeSchema,
  id: z.uuid(),
  title: z.string(),
  count: z.number().int(),
  color: z.string().nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Counter = z.infer<typeof CounterSchema>

/////////////////////////////////////////
// IDEMPOTENCY LOG SCHEMA
/////////////////////////////////////////

export const IdempotencyLogSchema = z.object({
  key: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date(),
})

export type IdempotencyLog = z.infer<typeof IdempotencyLogSchema>

/////////////////////////////////////////
// SELECT & INCLUDE
/////////////////////////////////////////

// USER
//------------------------------------------------------

export const UserIncludeSchema: z.ZodType<Prisma.UserInclude> = z.object({
  counters: z.union([z.boolean(),z.lazy(() => CounterFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict();

export const UserArgsSchema: z.ZodType<Prisma.UserDefaultArgs> = z.object({
  select: z.lazy(() => UserSelectSchema).optional(),
  include: z.lazy(() => UserIncludeSchema).optional(),
}).strict();

export const UserCountOutputTypeArgsSchema: z.ZodType<Prisma.UserCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => UserCountOutputTypeSelectSchema).nullish(),
}).strict();

export const UserCountOutputTypeSelectSchema: z.ZodType<Prisma.UserCountOutputTypeSelect> = z.object({
  counters: z.boolean().optional(),
}).strict();

export const UserSelectSchema: z.ZodType<Prisma.UserSelect> = z.object({
  id: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  password: z.boolean().optional(),
  tier: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  counters: z.union([z.boolean(),z.lazy(() => CounterFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict()

// COUNTER
//------------------------------------------------------

export const CounterIncludeSchema: z.ZodType<Prisma.CounterInclude> = z.object({
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict();

export const CounterArgsSchema: z.ZodType<Prisma.CounterDefaultArgs> = z.object({
  select: z.lazy(() => CounterSelectSchema).optional(),
  include: z.lazy(() => CounterIncludeSchema).optional(),
}).strict();

export const CounterSelectSchema: z.ZodType<Prisma.CounterSelect> = z.object({
  id: z.boolean().optional(),
  title: z.boolean().optional(),
  count: z.boolean().optional(),
  color: z.boolean().optional(),
  type: z.boolean().optional(),
  userId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

// IDEMPOTENCY LOG
//------------------------------------------------------

export const IdempotencyLogSelectSchema: z.ZodType<Prisma.IdempotencyLogSelect> = z.object({
  key: z.boolean().optional(),
  userId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
}).strict()


/////////////////////////////////////////
// INPUT TYPES
/////////////////////////////////////////

export const UserWhereInputSchema: z.ZodType<Prisma.UserWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  email: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  phone: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  password: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  tier: z.union([ z.lazy(() => EnumUserTierFilterSchema), z.lazy(() => UserTierSchema) ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  counters: z.lazy(() => CounterListRelationFilterSchema).optional(),
});

export const UserOrderByWithRelationInputSchema: z.ZodType<Prisma.UserOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  phone: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  password: z.lazy(() => SortOrderSchema).optional(),
  tier: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  counters: z.lazy(() => CounterOrderByRelationAggregateInputSchema).optional(),
});

export const UserWhereUniqueInputSchema: z.ZodType<Prisma.UserWhereUniqueInput> = z.union([
  z.object({
    id: z.uuid(),
    email: z.string(),
    phone: z.string(),
  }),
  z.object({
    id: z.uuid(),
    email: z.string(),
  }),
  z.object({
    id: z.uuid(),
    phone: z.string(),
  }),
  z.object({
    id: z.uuid(),
  }),
  z.object({
    email: z.string(),
    phone: z.string(),
  }),
  z.object({
    email: z.string(),
  }),
  z.object({
    phone: z.string(),
  }),
])
.and(z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  AND: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  password: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  tier: z.union([ z.lazy(() => EnumUserTierFilterSchema), z.lazy(() => UserTierSchema) ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  counters: z.lazy(() => CounterListRelationFilterSchema).optional(),
}));

export const UserOrderByWithAggregationInputSchema: z.ZodType<Prisma.UserOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  phone: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  password: z.lazy(() => SortOrderSchema).optional(),
  tier: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => UserCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => UserMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => UserMinOrderByAggregateInputSchema).optional(),
});

export const UserScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.UserScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema), z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema), z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => UuidWithAggregatesFilterSchema), z.string() ]).optional(),
  email: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  phone: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  password: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  tier: z.union([ z.lazy(() => EnumUserTierWithAggregatesFilterSchema), z.lazy(() => UserTierSchema) ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
});

export const CounterWhereInputSchema: z.ZodType<Prisma.CounterWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CounterWhereInputSchema), z.lazy(() => CounterWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CounterWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CounterWhereInputSchema), z.lazy(() => CounterWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  title: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  count: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  color: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  type: z.union([ z.lazy(() => EnumCounterTypeFilterSchema), z.lazy(() => CounterTypeSchema) ]).optional(),
  userId: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
});

export const CounterOrderByWithRelationInputSchema: z.ZodType<Prisma.CounterOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  count: z.lazy(() => SortOrderSchema).optional(),
  color: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
});

export const CounterWhereUniqueInputSchema: z.ZodType<Prisma.CounterWhereUniqueInput> = z.object({
  id: z.uuid(),
})
.and(z.strictObject({
  id: z.uuid().optional(),
  AND: z.union([ z.lazy(() => CounterWhereInputSchema), z.lazy(() => CounterWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CounterWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CounterWhereInputSchema), z.lazy(() => CounterWhereInputSchema).array() ]).optional(),
  title: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  count: z.union([ z.lazy(() => IntFilterSchema), z.number().int() ]).optional(),
  color: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  type: z.union([ z.lazy(() => EnumCounterTypeFilterSchema), z.lazy(() => CounterTypeSchema) ]).optional(),
  userId: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
}));

export const CounterOrderByWithAggregationInputSchema: z.ZodType<Prisma.CounterOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  count: z.lazy(() => SortOrderSchema).optional(),
  color: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => CounterCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => CounterAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => CounterMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => CounterMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => CounterSumOrderByAggregateInputSchema).optional(),
});

export const CounterScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.CounterScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CounterScalarWhereWithAggregatesInputSchema), z.lazy(() => CounterScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => CounterScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CounterScalarWhereWithAggregatesInputSchema), z.lazy(() => CounterScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  title: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  count: z.union([ z.lazy(() => IntWithAggregatesFilterSchema), z.number() ]).optional(),
  color: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  type: z.union([ z.lazy(() => EnumCounterTypeWithAggregatesFilterSchema), z.lazy(() => CounterTypeSchema) ]).optional(),
  userId: z.union([ z.lazy(() => UuidWithAggregatesFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
});

export const IdempotencyLogWhereInputSchema: z.ZodType<Prisma.IdempotencyLogWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => IdempotencyLogWhereInputSchema), z.lazy(() => IdempotencyLogWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IdempotencyLogWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IdempotencyLogWhereInputSchema), z.lazy(() => IdempotencyLogWhereInputSchema).array() ]).optional(),
  key: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  userId: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
});

export const IdempotencyLogOrderByWithRelationInputSchema: z.ZodType<Prisma.IdempotencyLogOrderByWithRelationInput> = z.strictObject({
  key: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
});

export const IdempotencyLogWhereUniqueInputSchema: z.ZodType<Prisma.IdempotencyLogWhereUniqueInput> = z.object({
  key: z.string(),
})
.and(z.strictObject({
  key: z.string().optional(),
  AND: z.union([ z.lazy(() => IdempotencyLogWhereInputSchema), z.lazy(() => IdempotencyLogWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IdempotencyLogWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IdempotencyLogWhereInputSchema), z.lazy(() => IdempotencyLogWhereInputSchema).array() ]).optional(),
  userId: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
}));

export const IdempotencyLogOrderByWithAggregationInputSchema: z.ZodType<Prisma.IdempotencyLogOrderByWithAggregationInput> = z.strictObject({
  key: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => IdempotencyLogCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => IdempotencyLogMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => IdempotencyLogMinOrderByAggregateInputSchema).optional(),
});

export const IdempotencyLogScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.IdempotencyLogScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => IdempotencyLogScalarWhereWithAggregatesInputSchema), z.lazy(() => IdempotencyLogScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => IdempotencyLogScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IdempotencyLogScalarWhereWithAggregatesInputSchema), z.lazy(() => IdempotencyLogScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  key: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  userId: z.union([ z.lazy(() => UuidWithAggregatesFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
});

export const UserCreateInputSchema: z.ZodType<Prisma.UserCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string(),
  tier: z.lazy(() => UserTierSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  counters: z.lazy(() => CounterCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUncheckedCreateInputSchema: z.ZodType<Prisma.UserUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string(),
  tier: z.lazy(() => UserTierSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  counters: z.lazy(() => CounterUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUpdateInputSchema: z.ZodType<Prisma.UserUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  counters: z.lazy(() => CounterUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserUncheckedUpdateInputSchema: z.ZodType<Prisma.UserUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  counters: z.lazy(() => CounterUncheckedUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserCreateManyInputSchema: z.ZodType<Prisma.UserCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string(),
  tier: z.lazy(() => UserTierSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const UserUpdateManyMutationInputSchema: z.ZodType<Prisma.UserUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const UserUncheckedUpdateManyInputSchema: z.ZodType<Prisma.UserUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterCreateInputSchema: z.ZodType<Prisma.CounterCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  user: z.lazy(() => UserCreateNestedOneWithoutCountersInputSchema),
});

export const CounterUncheckedCreateInputSchema: z.ZodType<Prisma.CounterUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  userId: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CounterUpdateInputSchema: z.ZodType<Prisma.CounterUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutCountersNestedInputSchema).optional(),
});

export const CounterUncheckedUpdateInputSchema: z.ZodType<Prisma.CounterUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterCreateManyInputSchema: z.ZodType<Prisma.CounterCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  userId: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CounterUpdateManyMutationInputSchema: z.ZodType<Prisma.CounterUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterUncheckedUpdateManyInputSchema: z.ZodType<Prisma.CounterUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const IdempotencyLogCreateInputSchema: z.ZodType<Prisma.IdempotencyLogCreateInput> = z.strictObject({
  key: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date().optional(),
});

export const IdempotencyLogUncheckedCreateInputSchema: z.ZodType<Prisma.IdempotencyLogUncheckedCreateInput> = z.strictObject({
  key: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date().optional(),
});

export const IdempotencyLogUpdateInputSchema: z.ZodType<Prisma.IdempotencyLogUpdateInput> = z.strictObject({
  key: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const IdempotencyLogUncheckedUpdateInputSchema: z.ZodType<Prisma.IdempotencyLogUncheckedUpdateInput> = z.strictObject({
  key: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const IdempotencyLogCreateManyInputSchema: z.ZodType<Prisma.IdempotencyLogCreateManyInput> = z.strictObject({
  key: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date().optional(),
});

export const IdempotencyLogUpdateManyMutationInputSchema: z.ZodType<Prisma.IdempotencyLogUpdateManyMutationInput> = z.strictObject({
  key: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const IdempotencyLogUncheckedUpdateManyInputSchema: z.ZodType<Prisma.IdempotencyLogUncheckedUpdateManyInput> = z.strictObject({
  key: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const UuidFilterSchema: z.ZodType<Prisma.UuidFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedUuidFilterSchema) ]).optional(),
});

export const StringNullableFilterSchema: z.ZodType<Prisma.StringNullableFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
});

export const StringFilterSchema: z.ZodType<Prisma.StringFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
});

export const EnumUserTierFilterSchema: z.ZodType<Prisma.EnumUserTierFilter> = z.strictObject({
  equals: z.lazy(() => UserTierSchema).optional(),
  in: z.lazy(() => UserTierSchema).array().optional(),
  notIn: z.lazy(() => UserTierSchema).array().optional(),
  not: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => NestedEnumUserTierFilterSchema) ]).optional(),
});

export const DateTimeFilterSchema: z.ZodType<Prisma.DateTimeFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
});

export const CounterListRelationFilterSchema: z.ZodType<Prisma.CounterListRelationFilter> = z.strictObject({
  every: z.lazy(() => CounterWhereInputSchema).optional(),
  some: z.lazy(() => CounterWhereInputSchema).optional(),
  none: z.lazy(() => CounterWhereInputSchema).optional(),
});

export const SortOrderInputSchema: z.ZodType<Prisma.SortOrderInput> = z.strictObject({
  sort: z.lazy(() => SortOrderSchema),
  nulls: z.lazy(() => NullsOrderSchema).optional(),
});

export const CounterOrderByRelationAggregateInputSchema: z.ZodType<Prisma.CounterOrderByRelationAggregateInput> = z.strictObject({
  _count: z.lazy(() => SortOrderSchema).optional(),
});

export const UserCountOrderByAggregateInputSchema: z.ZodType<Prisma.UserCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  phone: z.lazy(() => SortOrderSchema).optional(),
  password: z.lazy(() => SortOrderSchema).optional(),
  tier: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const UserMaxOrderByAggregateInputSchema: z.ZodType<Prisma.UserMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  phone: z.lazy(() => SortOrderSchema).optional(),
  password: z.lazy(() => SortOrderSchema).optional(),
  tier: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const UserMinOrderByAggregateInputSchema: z.ZodType<Prisma.UserMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  phone: z.lazy(() => SortOrderSchema).optional(),
  password: z.lazy(() => SortOrderSchema).optional(),
  tier: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const UuidWithAggregatesFilterSchema: z.ZodType<Prisma.UuidWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedUuidWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const StringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.StringNullableWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional(),
});

export const StringWithAggregatesFilterSchema: z.ZodType<Prisma.StringWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const EnumUserTierWithAggregatesFilterSchema: z.ZodType<Prisma.EnumUserTierWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => UserTierSchema).optional(),
  in: z.lazy(() => UserTierSchema).array().optional(),
  notIn: z.lazy(() => UserTierSchema).array().optional(),
  not: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => NestedEnumUserTierWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumUserTierFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumUserTierFilterSchema).optional(),
});

export const DateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.DateTimeWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional(),
});

export const IntFilterSchema: z.ZodType<Prisma.IntFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
});

export const EnumCounterTypeFilterSchema: z.ZodType<Prisma.EnumCounterTypeFilter> = z.strictObject({
  equals: z.lazy(() => CounterTypeSchema).optional(),
  in: z.lazy(() => CounterTypeSchema).array().optional(),
  notIn: z.lazy(() => CounterTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => NestedEnumCounterTypeFilterSchema) ]).optional(),
});

export const UserScalarRelationFilterSchema: z.ZodType<Prisma.UserScalarRelationFilter> = z.strictObject({
  is: z.lazy(() => UserWhereInputSchema).optional(),
  isNot: z.lazy(() => UserWhereInputSchema).optional(),
});

export const CounterCountOrderByAggregateInputSchema: z.ZodType<Prisma.CounterCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  count: z.lazy(() => SortOrderSchema).optional(),
  color: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const CounterAvgOrderByAggregateInputSchema: z.ZodType<Prisma.CounterAvgOrderByAggregateInput> = z.strictObject({
  count: z.lazy(() => SortOrderSchema).optional(),
});

export const CounterMaxOrderByAggregateInputSchema: z.ZodType<Prisma.CounterMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  count: z.lazy(() => SortOrderSchema).optional(),
  color: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const CounterMinOrderByAggregateInputSchema: z.ZodType<Prisma.CounterMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  title: z.lazy(() => SortOrderSchema).optional(),
  count: z.lazy(() => SortOrderSchema).optional(),
  color: z.lazy(() => SortOrderSchema).optional(),
  type: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const CounterSumOrderByAggregateInputSchema: z.ZodType<Prisma.CounterSumOrderByAggregateInput> = z.strictObject({
  count: z.lazy(() => SortOrderSchema).optional(),
});

export const IntWithAggregatesFilterSchema: z.ZodType<Prisma.IntWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional(),
});

export const EnumCounterTypeWithAggregatesFilterSchema: z.ZodType<Prisma.EnumCounterTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => CounterTypeSchema).optional(),
  in: z.lazy(() => CounterTypeSchema).array().optional(),
  notIn: z.lazy(() => CounterTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => NestedEnumCounterTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumCounterTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumCounterTypeFilterSchema).optional(),
});

export const IdempotencyLogCountOrderByAggregateInputSchema: z.ZodType<Prisma.IdempotencyLogCountOrderByAggregateInput> = z.strictObject({
  key: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
});

export const IdempotencyLogMaxOrderByAggregateInputSchema: z.ZodType<Prisma.IdempotencyLogMaxOrderByAggregateInput> = z.strictObject({
  key: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
});

export const IdempotencyLogMinOrderByAggregateInputSchema: z.ZodType<Prisma.IdempotencyLogMinOrderByAggregateInput> = z.strictObject({
  key: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
});

export const CounterCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.CounterCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterCreateWithoutUserInputSchema).array(), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema), z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CounterCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
});

export const CounterUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.CounterUncheckedCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterCreateWithoutUserInputSchema).array(), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema), z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CounterCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
});

export const StringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.StringFieldUpdateOperationsInput> = z.strictObject({
  set: z.string().optional(),
});

export const NullableStringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableStringFieldUpdateOperationsInput> = z.strictObject({
  set: z.string().optional().nullable(),
});

export const EnumUserTierFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumUserTierFieldUpdateOperationsInput> = z.strictObject({
  set: z.lazy(() => UserTierSchema).optional(),
});

export const DateTimeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.DateTimeFieldUpdateOperationsInput> = z.strictObject({
  set: z.coerce.date().optional(),
});

export const CounterUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.CounterUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterCreateWithoutUserInputSchema).array(), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema), z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CounterUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CounterUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CounterCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CounterUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CounterUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CounterUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => CounterUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CounterScalarWhereInputSchema), z.lazy(() => CounterScalarWhereInputSchema).array() ]).optional(),
});

export const CounterUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.CounterUncheckedUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterCreateWithoutUserInputSchema).array(), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema), z.lazy(() => CounterCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CounterUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CounterUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CounterCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CounterWhereUniqueInputSchema), z.lazy(() => CounterWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CounterUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CounterUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CounterUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => CounterUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CounterScalarWhereInputSchema), z.lazy(() => CounterScalarWhereInputSchema).array() ]).optional(),
});

export const UserCreateNestedOneWithoutCountersInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutCountersInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutCountersInputSchema), z.lazy(() => UserUncheckedCreateWithoutCountersInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCountersInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
});

export const IntFieldUpdateOperationsInputSchema: z.ZodType<Prisma.IntFieldUpdateOperationsInput> = z.strictObject({
  set: z.number().optional(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional(),
});

export const EnumCounterTypeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumCounterTypeFieldUpdateOperationsInput> = z.strictObject({
  set: z.lazy(() => CounterTypeSchema).optional(),
});

export const UserUpdateOneRequiredWithoutCountersNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutCountersNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutCountersInputSchema), z.lazy(() => UserUncheckedCreateWithoutCountersInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCountersInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutCountersInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutCountersInputSchema), z.lazy(() => UserUpdateWithoutCountersInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCountersInputSchema) ]).optional(),
});

export const NestedUuidFilterSchema: z.ZodType<Prisma.NestedUuidFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedUuidFilterSchema) ]).optional(),
});

export const NestedStringNullableFilterSchema: z.ZodType<Prisma.NestedStringNullableFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
});

export const NestedStringFilterSchema: z.ZodType<Prisma.NestedStringFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
});

export const NestedEnumUserTierFilterSchema: z.ZodType<Prisma.NestedEnumUserTierFilter> = z.strictObject({
  equals: z.lazy(() => UserTierSchema).optional(),
  in: z.lazy(() => UserTierSchema).array().optional(),
  notIn: z.lazy(() => UserTierSchema).array().optional(),
  not: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => NestedEnumUserTierFilterSchema) ]).optional(),
});

export const NestedDateTimeFilterSchema: z.ZodType<Prisma.NestedDateTimeFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
});

export const NestedUuidWithAggregatesFilterSchema: z.ZodType<Prisma.NestedUuidWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedUuidWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const NestedIntFilterSchema: z.ZodType<Prisma.NestedIntFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
});

export const NestedStringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringNullableWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional(),
});

export const NestedIntNullableFilterSchema: z.ZodType<Prisma.NestedIntNullableFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntNullableFilterSchema) ]).optional().nullable(),
});

export const NestedStringWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const NestedEnumUserTierWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumUserTierWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => UserTierSchema).optional(),
  in: z.lazy(() => UserTierSchema).array().optional(),
  notIn: z.lazy(() => UserTierSchema).array().optional(),
  not: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => NestedEnumUserTierWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumUserTierFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumUserTierFilterSchema).optional(),
});

export const NestedDateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedDateTimeWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional(),
});

export const NestedEnumCounterTypeFilterSchema: z.ZodType<Prisma.NestedEnumCounterTypeFilter> = z.strictObject({
  equals: z.lazy(() => CounterTypeSchema).optional(),
  in: z.lazy(() => CounterTypeSchema).array().optional(),
  notIn: z.lazy(() => CounterTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => NestedEnumCounterTypeFilterSchema) ]).optional(),
});

export const NestedIntWithAggregatesFilterSchema: z.ZodType<Prisma.NestedIntWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional(),
});

export const NestedFloatFilterSchema: z.ZodType<Prisma.NestedFloatFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatFilterSchema) ]).optional(),
});

export const NestedEnumCounterTypeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumCounterTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => CounterTypeSchema).optional(),
  in: z.lazy(() => CounterTypeSchema).array().optional(),
  notIn: z.lazy(() => CounterTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => NestedEnumCounterTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumCounterTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumCounterTypeFilterSchema).optional(),
});

export const CounterCreateWithoutUserInputSchema: z.ZodType<Prisma.CounterCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CounterUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.CounterUncheckedCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CounterCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.CounterCreateOrConnectWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CounterWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema) ]),
});

export const CounterCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.CounterCreateManyUserInputEnvelope> = z.strictObject({
  data: z.union([ z.lazy(() => CounterCreateManyUserInputSchema), z.lazy(() => CounterCreateManyUserInputSchema).array() ]),
  skipDuplicates: z.boolean().optional(),
});

export const CounterUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.CounterUpsertWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CounterWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CounterUpdateWithoutUserInputSchema), z.lazy(() => CounterUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => CounterCreateWithoutUserInputSchema), z.lazy(() => CounterUncheckedCreateWithoutUserInputSchema) ]),
});

export const CounterUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.CounterUpdateWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CounterWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => CounterUpdateWithoutUserInputSchema), z.lazy(() => CounterUncheckedUpdateWithoutUserInputSchema) ]),
});

export const CounterUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.CounterUpdateManyWithWhereWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CounterScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CounterUpdateManyMutationInputSchema), z.lazy(() => CounterUncheckedUpdateManyWithoutUserInputSchema) ]),
});

export const CounterScalarWhereInputSchema: z.ZodType<Prisma.CounterScalarWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CounterScalarWhereInputSchema), z.lazy(() => CounterScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CounterScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CounterScalarWhereInputSchema), z.lazy(() => CounterScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  title: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  count: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  color: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  type: z.union([ z.lazy(() => EnumCounterTypeFilterSchema), z.lazy(() => CounterTypeSchema) ]).optional(),
  userId: z.union([ z.lazy(() => UuidFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
});

export const UserCreateWithoutCountersInputSchema: z.ZodType<Prisma.UserCreateWithoutCountersInput> = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string(),
  tier: z.lazy(() => UserTierSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const UserUncheckedCreateWithoutCountersInputSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutCountersInput> = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string(),
  tier: z.lazy(() => UserTierSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const UserCreateOrConnectWithoutCountersInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutCountersInput> = z.strictObject({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutCountersInputSchema), z.lazy(() => UserUncheckedCreateWithoutCountersInputSchema) ]),
});

export const UserUpsertWithoutCountersInputSchema: z.ZodType<Prisma.UserUpsertWithoutCountersInput> = z.strictObject({
  update: z.union([ z.lazy(() => UserUpdateWithoutCountersInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCountersInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutCountersInputSchema), z.lazy(() => UserUncheckedCreateWithoutCountersInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional(),
});

export const UserUpdateToOneWithWhereWithoutCountersInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutCountersInput> = z.strictObject({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutCountersInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCountersInputSchema) ]),
});

export const UserUpdateWithoutCountersInputSchema: z.ZodType<Prisma.UserUpdateWithoutCountersInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const UserUncheckedUpdateWithoutCountersInputSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutCountersInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  phone: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  password: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  tier: z.union([ z.lazy(() => UserTierSchema), z.lazy(() => EnumUserTierFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterCreateManyUserInputSchema: z.ZodType<Prisma.CounterCreateManyUserInput> = z.strictObject({
  id: z.uuid().optional(),
  title: z.string(),
  count: z.number().int().optional(),
  color: z.string().optional().nullable(),
  type: z.lazy(() => CounterTypeSchema).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CounterUpdateWithoutUserInputSchema: z.ZodType<Prisma.CounterUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterUncheckedUpdateWithoutUserInputSchema: z.ZodType<Prisma.CounterUncheckedUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CounterUncheckedUpdateManyWithoutUserInputSchema: z.ZodType<Prisma.CounterUncheckedUpdateManyWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  title: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  count: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  color: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  type: z.union([ z.lazy(() => CounterTypeSchema), z.lazy(() => EnumCounterTypeFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

/////////////////////////////////////////
// ARGS
/////////////////////////////////////////

export const UserFindFirstArgsSchema: z.ZodType<Prisma.UserFindFirstArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserFindFirstOrThrowArgsSchema: z.ZodType<Prisma.UserFindFirstOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserFindManyArgsSchema: z.ZodType<Prisma.UserFindManyArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserAggregateArgsSchema: z.ZodType<Prisma.UserAggregateArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const UserGroupByArgsSchema: z.ZodType<Prisma.UserGroupByArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithAggregationInputSchema.array(), UserOrderByWithAggregationInputSchema ]).optional(),
  by: UserScalarFieldEnumSchema.array(), 
  having: UserScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const UserFindUniqueArgsSchema: z.ZodType<Prisma.UserFindUniqueArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.UserFindUniqueOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const CounterFindFirstArgsSchema: z.ZodType<Prisma.CounterFindFirstArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereInputSchema.optional(), 
  orderBy: z.union([ CounterOrderByWithRelationInputSchema.array(), CounterOrderByWithRelationInputSchema ]).optional(),
  cursor: CounterWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CounterScalarFieldEnumSchema, CounterScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CounterFindFirstOrThrowArgsSchema: z.ZodType<Prisma.CounterFindFirstOrThrowArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereInputSchema.optional(), 
  orderBy: z.union([ CounterOrderByWithRelationInputSchema.array(), CounterOrderByWithRelationInputSchema ]).optional(),
  cursor: CounterWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CounterScalarFieldEnumSchema, CounterScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CounterFindManyArgsSchema: z.ZodType<Prisma.CounterFindManyArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereInputSchema.optional(), 
  orderBy: z.union([ CounterOrderByWithRelationInputSchema.array(), CounterOrderByWithRelationInputSchema ]).optional(),
  cursor: CounterWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CounterScalarFieldEnumSchema, CounterScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CounterAggregateArgsSchema: z.ZodType<Prisma.CounterAggregateArgs> = z.object({
  where: CounterWhereInputSchema.optional(), 
  orderBy: z.union([ CounterOrderByWithRelationInputSchema.array(), CounterOrderByWithRelationInputSchema ]).optional(),
  cursor: CounterWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const CounterGroupByArgsSchema: z.ZodType<Prisma.CounterGroupByArgs> = z.object({
  where: CounterWhereInputSchema.optional(), 
  orderBy: z.union([ CounterOrderByWithAggregationInputSchema.array(), CounterOrderByWithAggregationInputSchema ]).optional(),
  by: CounterScalarFieldEnumSchema.array(), 
  having: CounterScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const CounterFindUniqueArgsSchema: z.ZodType<Prisma.CounterFindUniqueArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereUniqueInputSchema, 
}).strict();

export const CounterFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.CounterFindUniqueOrThrowArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereUniqueInputSchema, 
}).strict();

export const IdempotencyLogFindFirstArgsSchema: z.ZodType<Prisma.IdempotencyLogFindFirstArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereInputSchema.optional(), 
  orderBy: z.union([ IdempotencyLogOrderByWithRelationInputSchema.array(), IdempotencyLogOrderByWithRelationInputSchema ]).optional(),
  cursor: IdempotencyLogWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ IdempotencyLogScalarFieldEnumSchema, IdempotencyLogScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const IdempotencyLogFindFirstOrThrowArgsSchema: z.ZodType<Prisma.IdempotencyLogFindFirstOrThrowArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereInputSchema.optional(), 
  orderBy: z.union([ IdempotencyLogOrderByWithRelationInputSchema.array(), IdempotencyLogOrderByWithRelationInputSchema ]).optional(),
  cursor: IdempotencyLogWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ IdempotencyLogScalarFieldEnumSchema, IdempotencyLogScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const IdempotencyLogFindManyArgsSchema: z.ZodType<Prisma.IdempotencyLogFindManyArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereInputSchema.optional(), 
  orderBy: z.union([ IdempotencyLogOrderByWithRelationInputSchema.array(), IdempotencyLogOrderByWithRelationInputSchema ]).optional(),
  cursor: IdempotencyLogWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ IdempotencyLogScalarFieldEnumSchema, IdempotencyLogScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const IdempotencyLogAggregateArgsSchema: z.ZodType<Prisma.IdempotencyLogAggregateArgs> = z.object({
  where: IdempotencyLogWhereInputSchema.optional(), 
  orderBy: z.union([ IdempotencyLogOrderByWithRelationInputSchema.array(), IdempotencyLogOrderByWithRelationInputSchema ]).optional(),
  cursor: IdempotencyLogWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const IdempotencyLogGroupByArgsSchema: z.ZodType<Prisma.IdempotencyLogGroupByArgs> = z.object({
  where: IdempotencyLogWhereInputSchema.optional(), 
  orderBy: z.union([ IdempotencyLogOrderByWithAggregationInputSchema.array(), IdempotencyLogOrderByWithAggregationInputSchema ]).optional(),
  by: IdempotencyLogScalarFieldEnumSchema.array(), 
  having: IdempotencyLogScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const IdempotencyLogFindUniqueArgsSchema: z.ZodType<Prisma.IdempotencyLogFindUniqueArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereUniqueInputSchema, 
}).strict();

export const IdempotencyLogFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.IdempotencyLogFindUniqueOrThrowArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereUniqueInputSchema, 
}).strict();

export const UserCreateArgsSchema: z.ZodType<Prisma.UserCreateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserCreateInputSchema, UserUncheckedCreateInputSchema ]),
}).strict();

export const UserUpsertArgsSchema: z.ZodType<Prisma.UserUpsertArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
  create: z.union([ UserCreateInputSchema, UserUncheckedCreateInputSchema ]),
  update: z.union([ UserUpdateInputSchema, UserUncheckedUpdateInputSchema ]),
}).strict();

export const UserCreateManyArgsSchema: z.ZodType<Prisma.UserCreateManyArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema, UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const UserCreateManyAndReturnArgsSchema: z.ZodType<Prisma.UserCreateManyAndReturnArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema, UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const UserDeleteArgsSchema: z.ZodType<Prisma.UserDeleteArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserUpdateArgsSchema: z.ZodType<Prisma.UserUpdateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserUpdateInputSchema, UserUncheckedUpdateInputSchema ]),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserUpdateManyArgsSchema: z.ZodType<Prisma.UserUpdateManyArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema, UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const UserUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.UserUpdateManyAndReturnArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema, UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const UserDeleteManyArgsSchema: z.ZodType<Prisma.UserDeleteManyArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CounterCreateArgsSchema: z.ZodType<Prisma.CounterCreateArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  data: z.union([ CounterCreateInputSchema, CounterUncheckedCreateInputSchema ]),
}).strict();

export const CounterUpsertArgsSchema: z.ZodType<Prisma.CounterUpsertArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereUniqueInputSchema, 
  create: z.union([ CounterCreateInputSchema, CounterUncheckedCreateInputSchema ]),
  update: z.union([ CounterUpdateInputSchema, CounterUncheckedUpdateInputSchema ]),
}).strict();

export const CounterCreateManyArgsSchema: z.ZodType<Prisma.CounterCreateManyArgs> = z.object({
  data: z.union([ CounterCreateManyInputSchema, CounterCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const CounterCreateManyAndReturnArgsSchema: z.ZodType<Prisma.CounterCreateManyAndReturnArgs> = z.object({
  data: z.union([ CounterCreateManyInputSchema, CounterCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const CounterDeleteArgsSchema: z.ZodType<Prisma.CounterDeleteArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  where: CounterWhereUniqueInputSchema, 
}).strict();

export const CounterUpdateArgsSchema: z.ZodType<Prisma.CounterUpdateArgs> = z.object({
  select: CounterSelectSchema.optional(),
  include: CounterIncludeSchema.optional(),
  data: z.union([ CounterUpdateInputSchema, CounterUncheckedUpdateInputSchema ]),
  where: CounterWhereUniqueInputSchema, 
}).strict();

export const CounterUpdateManyArgsSchema: z.ZodType<Prisma.CounterUpdateManyArgs> = z.object({
  data: z.union([ CounterUpdateManyMutationInputSchema, CounterUncheckedUpdateManyInputSchema ]),
  where: CounterWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CounterUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.CounterUpdateManyAndReturnArgs> = z.object({
  data: z.union([ CounterUpdateManyMutationInputSchema, CounterUncheckedUpdateManyInputSchema ]),
  where: CounterWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CounterDeleteManyArgsSchema: z.ZodType<Prisma.CounterDeleteManyArgs> = z.object({
  where: CounterWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const IdempotencyLogCreateArgsSchema: z.ZodType<Prisma.IdempotencyLogCreateArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  data: z.union([ IdempotencyLogCreateInputSchema, IdempotencyLogUncheckedCreateInputSchema ]),
}).strict();

export const IdempotencyLogUpsertArgsSchema: z.ZodType<Prisma.IdempotencyLogUpsertArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereUniqueInputSchema, 
  create: z.union([ IdempotencyLogCreateInputSchema, IdempotencyLogUncheckedCreateInputSchema ]),
  update: z.union([ IdempotencyLogUpdateInputSchema, IdempotencyLogUncheckedUpdateInputSchema ]),
}).strict();

export const IdempotencyLogCreateManyArgsSchema: z.ZodType<Prisma.IdempotencyLogCreateManyArgs> = z.object({
  data: z.union([ IdempotencyLogCreateManyInputSchema, IdempotencyLogCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const IdempotencyLogCreateManyAndReturnArgsSchema: z.ZodType<Prisma.IdempotencyLogCreateManyAndReturnArgs> = z.object({
  data: z.union([ IdempotencyLogCreateManyInputSchema, IdempotencyLogCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const IdempotencyLogDeleteArgsSchema: z.ZodType<Prisma.IdempotencyLogDeleteArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  where: IdempotencyLogWhereUniqueInputSchema, 
}).strict();

export const IdempotencyLogUpdateArgsSchema: z.ZodType<Prisma.IdempotencyLogUpdateArgs> = z.object({
  select: IdempotencyLogSelectSchema.optional(),
  data: z.union([ IdempotencyLogUpdateInputSchema, IdempotencyLogUncheckedUpdateInputSchema ]),
  where: IdempotencyLogWhereUniqueInputSchema, 
}).strict();

export const IdempotencyLogUpdateManyArgsSchema: z.ZodType<Prisma.IdempotencyLogUpdateManyArgs> = z.object({
  data: z.union([ IdempotencyLogUpdateManyMutationInputSchema, IdempotencyLogUncheckedUpdateManyInputSchema ]),
  where: IdempotencyLogWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const IdempotencyLogUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.IdempotencyLogUpdateManyAndReturnArgs> = z.object({
  data: z.union([ IdempotencyLogUpdateManyMutationInputSchema, IdempotencyLogUncheckedUpdateManyInputSchema ]),
  where: IdempotencyLogWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const IdempotencyLogDeleteManyArgsSchema: z.ZodType<Prisma.IdempotencyLogDeleteManyArgs> = z.object({
  where: IdempotencyLogWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();