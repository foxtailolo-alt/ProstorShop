import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { StoreNav } from "../../../../../components/layout/store-nav";
import { getSession } from "../../../../../lib/auth/session";
import { getActiveTradeInSnapshot } from "../../../../../lib/data/pricing";
import { getTradeInModels } from "../../../../../lib/trade-in-snapshot";
import { normalizeText } from "../../../../../lib/upgrade-suggestions";
import { TradeInWizard } from "../../../trade-in/trade-in-wizard";

type AddProfileDevicePageProps = {
  searchParams?: Promise<{
    deviceId?: string;
  }>;
};

function inferModelCodeFromDevice(snapshot: NonNullable<Awaited<ReturnType<typeof getActiveTradeInSnapshot>>>, categoryCode: string, model: string) {
  const models = getTradeInModels(snapshot, categoryCode);
  const normalizedModel = ` ${normalizeText(model)} `;
  const matched = models
    .slice()
    .sort((left, right) => right.title.length - left.title.length)
    .find((candidate) => normalizedModel.includes(` ${normalizeText(candidate.title)} `));

  return matched?.code ?? models[0]?.code ?? null;
}

export default async function AddProfileDevicePage({ searchParams }: AddProfileDevicePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const deviceId = resolvedSearchParams?.deviceId?.trim() || null;
  const [session, snapshot] = await Promise.all([getSession(), getActiveTradeInSnapshot()]);

  if (!session) {
    redirect("/profile");
  }

  const existingDevice = deviceId
    ? await prisma.userDevice.findFirst({
        where: {
          id: deviceId,
          userId: session.user.id,
        },
        select: {
          id: true,
          nickname: true,
          categoryCode: true,
          deviceModelCode: true,
          model: true,
          answersJson: true,
        },
      })
    : null;

  const initialProfileDevice = snapshot && existingDevice
    ? {
        deviceId: existingDevice.id,
        nickname: existingDevice.nickname,
        categoryCode: existingDevice.categoryCode,
        deviceModelCode: existingDevice.deviceModelCode ?? inferModelCodeFromDevice(snapshot, existingDevice.categoryCode, existingDevice.model),
        answersJson:
          existingDevice.answersJson && typeof existingDevice.answersJson === "object" && !Array.isArray(existingDevice.answersJson)
            ? Object.fromEntries(Object.entries(existingDevice.answersJson).filter(([, value]) => typeof value === "string")) as Record<string, string>
            : {},
      }
    : null;

  return (
    <main className="page shell">
      <StoreNav />
      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Добавить устройство</h1>
        <p className="store-page-subtitle">
          Тот же snapshot wizard, что и в trade-in, но сохранение идет сразу в ваш профиль.
        </p>
      </section>

      <section className="store-section">
        {snapshot ? (
          <TradeInWizard snapshot={snapshot} canSaveToProfile mode="profile" initialProfileDevice={initialProfileDevice} />
        ) : (
          <div className="card glass">
            <h2>Snapshot пока недоступен</h2>
            <p className="muted">Сначала обновите trade-in snapshot в админке, затем повторите добавление устройства.</p>
            <div className="actions">
              <Link className="button button-secondary" href="/profile">Вернуться в профиль</Link>
              <Link className="button button-primary" href="/trade-in">Открыть Trade-in</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}