import DatePicker from "react-datepicker";
import {
  formatLocalDateInput,
  formatLocalDateTimeInput,
  parseLocalDateInput,
  parseLocalDateTimeInput,
} from "./localDateTimeFormat";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./LocalDateTimePicker.module.css";

export type LocalDateTimePickerProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** When false, value is `YYYY-MM-DD` only (e.g. report range). */
  withTime?: boolean;
  placeholderText?: string;
};

export function LocalDateTimePicker({
  value,
  onChange,
  className,
  disabled,
  required,
  id,
  withTime = true,
  placeholderText,
}: LocalDateTimePickerProps) {
  const selected = withTime ? parseLocalDateTimeInput(value) : parseLocalDateInput(value);

  return (
    <div className={styles.wrap}>
      <DatePicker
        id={id}
        required={required}
        disabled={disabled}
        selected={selected}
        onChange={(d: Date | null) => {
          if (!d) {
            onChange("");
            return;
          }
          onChange(withTime ? formatLocalDateTimeInput(d) : formatLocalDateInput(d));
        }}
        showTimeInput={withTime}
        showTimeSelect={false}
        dateFormat={withTime ? "MM/dd/yyyy h:mm aa" : "MM/dd/yyyy"}
        timeInputLabel="Time"
        className={className ?? styles.input}
        wrapperClassName={styles.wrapper}
        popperClassName={styles.popper}
        calendarClassName={styles.calendar}
        placeholderText={placeholderText ?? (withTime ? "Select date and time" : "Select date")}
        autoComplete="off"
        isClearable={!required}
        portalId="iiw-datepicker-root"
        showPopperArrow={false}
      />
    </div>
  );
}
