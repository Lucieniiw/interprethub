import type { Client } from "#prisma-client";

/** Stored rates are plain USD amounts; formatting adds $ and unit for APIs / invoices. */

function moneyUsd(n: number): string {
  const x = Number(n);
  const safe = Number.isFinite(x) ? x : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/** In-person, phone, virtual, travel time — billed per hour */
export function formatUsdPerHour(value: number): string {
  return `${moneyUsd(value)} per hour`;
}

/** Mileage — billed per mile */
export function formatUsdPerMile(value: number): string {
  return `${moneyUsd(value)} per mile`;
}

export type ClientApiRecord = Client & {
  rateInPersonFormatted: string;
  ratePhoneFormatted: string;
  rateVirtualFormatted: string;
  rateMileageFormatted: string;
  rateTravelTimeFormatted: string;
};

export function enrichClientResponse(c: Client): ClientApiRecord {
  return {
    ...c,
    rateInPersonFormatted: formatUsdPerHour(c.rateInPerson),
    ratePhoneFormatted: formatUsdPerHour(c.ratePhone),
    rateVirtualFormatted: formatUsdPerHour(c.rateVirtual),
    rateMileageFormatted: formatUsdPerMile(c.rateMileage),
    rateTravelTimeFormatted: formatUsdPerHour(c.rateTravelTime),
  };
}
