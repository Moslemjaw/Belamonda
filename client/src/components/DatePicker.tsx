import React from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ar from 'date-fns/locale/ar-SA';
import enGB from 'date-fns/locale/en-GB';
import i18n from '../app/i18n';

registerLocale('ar', ar);
registerLocale('en', enGB);

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  showTimeSelect?: boolean;
}

export default function DatePicker({ value, onChange, className, showTimeSelect, ...props }: DatePickerProps) {
  // If the string is empty or invalid, dateValue will be null
  const dateValue = value && !isNaN(new Date(value).getTime()) ? new Date(value) : null;

  const handleChange = (date: Date | null) => {
    if (onChange) {
      if (!date) {
        onChange({ target: { value: '', name: props.name } });
        return;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      if (showTimeSelect) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        onChange({ target: { value: `${year}-${month}-${day}T${hours}:${minutes}`, name: props.name } });
      } else {
        onChange({ target: { value: `${year}-${month}-${day}`, name: props.name } });
      }
    }
  };

  const isAr = i18n.language === 'ar';

  return (
    <div className="w-full">
      <ReactDatePicker
        selected={dateValue}
        onChange={handleChange}
        dateFormat={showTimeSelect ? "dd/MM/yyyy h:mm aa" : "dd/MM/yyyy"}
        className={className}
        wrapperClassName="w-full"
        placeholderText={isAr ? (showTimeSelect ? 'يوم/شهر/سنة س:د م' : 'يوم/شهر/سنة') : (showTimeSelect ? 'dd/mm/yyyy hh:mm aa' : 'dd/mm/yyyy')}
        locale={isAr ? 'ar' : 'en'}
        showTimeSelect={showTimeSelect}
        timeFormat="h:mm aa"
        timeIntervals={15}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        {...(props as any)}
      />
    </div>
  );
}
