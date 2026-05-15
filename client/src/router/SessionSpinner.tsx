import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";

/** Shown while `/auth/me` resolves so we never treat “user still loading” as “logged out”. */
export function SessionSpinner() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading session"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "40vh",
      }}
    >
      <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
    </div>
  );
}
