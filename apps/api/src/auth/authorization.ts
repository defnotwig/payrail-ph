import { SetMetadata } from "@nestjs/common";
import type { SessionPayload } from "./auth.service";
export const PUBLIC_ROUTE = "payrail:public";
export const ALLOW_API_KEY = "payrail:api-key";
export const PERMISSIONS = "payrail:permissions";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS, permissions);
export interface OperatorRequest {
  user: SessionPayload;
}
