import { cookies } from "next/headers";

export async function isMarketingMode() {
  const cookieStore = await cookies();
  return cookieStore.get("prostor_marketing")?.value === "1";
}
