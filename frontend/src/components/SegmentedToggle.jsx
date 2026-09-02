import React from 'react'

// Accessible segmented toggle. `options` = [{ value, label }].
// Uses aria-pressed on each button so screen readers announce the active choice.
export default function SegmentedToggle({ name, value, options, onChange, labelledBy }) {
  return (
    <div className="segmented" role="group" aria-labelledby={labelledBy} data-toggle={name}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
