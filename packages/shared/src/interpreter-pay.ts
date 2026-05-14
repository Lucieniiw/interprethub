/** Interpreter pay from linguist profile + job completion fields (USD). */

export type InterpreterPayProfile = {
  rateInPerson: number;
  rateVirtual: number;
  ratePhone: number;
  rateMileage: number;
  rateTravelTime: number;
};

export type InterpretationPayInput = {
  serviceType: "IN_PERSON" | "VIRTUAL" | "PHONE";
  interpreterSessionOutcome: "COMPLETED_SESSION" | "LATE_CANCELLATION" | null;
  interpreterStartTime: Date | string | null;
  interpreterEndTime: Date | string | null;
  durationMinutes: number | null;
  scheduledStartTime: Date | string;
  scheduledEndTime: Date | string;
  interpreterMileage: number | null;
  /** Billable travel time stored in minutes (UI collects hours; minimum 60 when > 0). */
  interpreterTravelTime: number | null;
  interpreterTravelOutsideCounty: boolean | null;
};

export type InterpretationPayBreakdown = {
  billableSessionHours: number | null;
  hourlyRate: number;
  serviceUsd: number;
  miles: number;
  mileageRate: number;
  mileageUsd: number;
  travelMinutes: number;
  travelHours: number;
  travelRatePerHour: number;
  travelUsd: number;
  totalUsd: number;
};

function sessionHours(
  start: Date | string | null,
  end: Date | string | null,
): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return (b - a) / 3600000;
}

export function hourlyRateForModality(
  serviceType: InterpretationPayInput["serviceType"],
  profile: InterpreterPayProfile | null | undefined,
): number {
  if (!profile) return 0;
  switch (serviceType) {
    case "IN_PERSON":
      return profile.rateInPerson;
    case "VIRTUAL":
      return profile.rateVirtual;
    case "PHONE":
      return profile.ratePhone;
    default:
      return 0;
  }
}

/** Session hours used for pay: interpreter-reported window, else scheduled job window. */
export function resolveBillableInterpretationHours(input: InterpretationPayInput): number | null {
  const fromInterpreter = sessionHours(input.interpreterStartTime, input.interpreterEndTime);
  if (fromInterpreter != null && fromInterpreter > 0) return fromInterpreter;
  if (input.durationMinutes != null && input.durationMinutes > 0) {
    return input.durationMinutes / 60;
  }
  return sessionHours(input.scheduledStartTime, input.scheduledEndTime);
}

export function computeInterpretationPayBreakdown(
  profile: InterpreterPayProfile | null | undefined,
  input: InterpretationPayInput,
): InterpretationPayBreakdown {
  const hourlyRate = hourlyRateForModality(input.serviceType, profile);
  const mileageRate = profile?.rateMileage ?? 0;
  const travelRatePerHour = profile?.rateTravelTime ?? 0;

  if (input.interpreterSessionOutcome === "LATE_CANCELLATION") {
    return {
      billableSessionHours: null,
      hourlyRate,
      serviceUsd: 0,
      miles: 0,
      mileageRate,
      mileageUsd: 0,
      travelMinutes: 0,
      travelHours: 0,
      travelRatePerHour,
      travelUsd: 0,
      totalUsd: 0,
    };
  }

  const billableSessionHours = resolveBillableInterpretationHours(input);
  const h = billableSessionHours != null && billableSessionHours > 0 ? billableSessionHours : 0;
  const serviceUsd = hourlyRate * h;

  const miles = Math.max(0, input.interpreterMileage ?? 0);
  const mileageUsd = miles * mileageRate;

  const travelMinutes =
    input.interpreterTravelOutsideCounty === true && (input.interpreterTravelTime ?? 0) > 0
      ? (input.interpreterTravelTime as number)
      : 0;
  const travelHours = travelMinutes / 60;
  const travelUsd = travelHours * travelRatePerHour;

  return {
    billableSessionHours: billableSessionHours != null && billableSessionHours > 0 ? billableSessionHours : null,
    hourlyRate,
    serviceUsd,
    miles,
    mileageRate,
    mileageUsd,
    travelMinutes,
    travelHours,
    travelRatePerHour,
    travelUsd,
    totalUsd: serviceUsd + mileageUsd + travelUsd,
  };
}

export type TranslationPayBreakdown = {
  flatUsd: number;
  rushUsd: number;
  totalUsd: number;
};

export function computeTranslationPayBreakdown(rate: number, rushFee: number | null | undefined): TranslationPayBreakdown {
  const flatUsd = Math.max(0, rate ?? 0);
  const rushUsd = Math.max(0, rushFee ?? 0);
  return { flatUsd, rushUsd, totalUsd: flatUsd + rushUsd };
}
