'use client'

export interface VisualTagOption<T extends string = string> {
  value: T
  label: string
  sublabel?: string
  icon?: string
  disabled?: boolean
  badge?: string
}

type BaseProps<T extends string> = {
  options: VisualTagOption<T>[]
  className?: string
  size?: 'sm' | 'md'
}

type SingleSelectProps<T extends string> = BaseProps<T> & {
  multiSelect?: false | undefined
  value: T
  onChange: (value: T) => void
}

type MultiSelectProps<T extends string> = BaseProps<T> & {
  multiSelect: true
  value: T[]
  onChange: (value: T[]) => void
}

export type VisualTagPickerProps<T extends string = string> =
  | SingleSelectProps<T>
  | MultiSelectProps<T>

export function VisualTagPicker<T extends string = string>(
  props: VisualTagPickerProps<T>,
) {
  const { options, className = '', size = 'md' } = props

  const isSelected = (v: T): boolean =>
    props.multiSelect === true
      ? (props.value as T[]).includes(v)
      : (props.value as T) === v

  const toggle = (v: T) => {
    if (props.multiSelect === true) {
      const cur = props.value as T[]
      ;(props.onChange as (val: T[]) => void)(
        cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
      )
    } else {
      const fn = props.onChange as (val: T) => void
      fn(v)
    }
  }

  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1.5'
  const textCls = size === 'sm' ? 'text-[9px]' : 'text-[10px]'
  const subCls = size === 'sm' ? 'text-[7.5px]' : 'text-[8px]'

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {options.map((opt) => {
        const sel = isSelected(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => toggle(opt.value)}
            title={opt.sublabel}
            className={`flex items-center gap-1 rounded-lg border transition ${pad} ${
              sel
                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                : 'border-white/8 bg-white/[0.03] text-white/50 hover:border-white/16 hover:bg-white/[0.06] hover:text-white/80'
            } ${opt.disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
          >
            {opt.icon ? (
              <span className="leading-none">{opt.icon}</span>
            ) : null}
            <span className={`${textCls} font-medium leading-none`}>{opt.label}</span>
            {opt.sublabel ? (
              <span className={`${subCls} leading-none ${sel ? 'text-indigo-300/55' : 'text-white/25'}`}>
                {opt.sublabel}
              </span>
            ) : null}
            {opt.badge ? (
              <span className="rounded-sm bg-white/8 px-1 py-px text-[7px] text-white/35">
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
