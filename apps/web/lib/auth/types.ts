import type { AdminRole } from "@prostor/core";

export type SessionRole = AdminRole | "customer";

export type SessionUser = {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  roles: SessionRole[];
};

export type TelegramAuthInput = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};