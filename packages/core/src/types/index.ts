import { z } from "zod";

export * from "../types/generated/index.js";
export type * from "../types/models.js";
export type * from "../types/requests.js";
export type * from "../types/responses.js";

export const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Must be a valid Hex color")
  .brand("HexColor");

export type HexColor = z.infer<typeof HexColorSchema>;
