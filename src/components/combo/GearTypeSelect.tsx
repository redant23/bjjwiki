'use client';

import { COMBO_GEAR_TYPES, comboGearLabel, type ComboGearType } from '@/lib/combo-type';

interface GearTypeSelectProps {
  value: ComboGearType | '';
  onChange: (value: ComboGearType) => void;
  disabled?: boolean;
}

/** 콤보 "영상 복장" 선택 (기/노기). */
export default function GearTypeSelect({ value, onChange, disabled }: GearTypeSelectProps) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="영상 복장">
      {COMBO_GEAR_TYPES.map((gear) => (
        <button
          key={gear}
          type="button"
          role="radio"
          aria-checked={value === gear}
          disabled={disabled}
          onClick={() => onChange(gear)}
          className={`px-4 py-2 text-sm rounded-md border transition-colors disabled:opacity-50 ${
            value === gear
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-input text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {comboGearLabel(gear)}
        </button>
      ))}
    </div>
  );
}
