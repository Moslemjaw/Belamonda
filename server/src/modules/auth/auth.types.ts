import type { Role } from "@belamonda/shared";

export type AccessTokenPayload = {
  sub: string;
  role: Role;
};

