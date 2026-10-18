import { SetMetadata } from "@nestjs/common";

export type UserRole = "VIEWER" | "SUPPORT" | "FINANCE" | "ENGINEER" | "ADMIN";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
