import type { ReactNode } from "react";
import { StoreFooter } from "../../components/layout/store-footer";

type StoreLayoutProps = {
  children: ReactNode;
};

export default function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      {children}
      <StoreFooter />
    </>
  );
}