import type { ReactNode } from "react";

type MiniAppLayoutProps = {
  children: ReactNode;
};

export default function MiniAppLayout({ children }: MiniAppLayoutProps) {
  return children;
}