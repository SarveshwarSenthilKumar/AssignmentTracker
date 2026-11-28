import { useId, useRef, useState } from 'react'
import { Eye, LayoutGrid, ListChecks, Navigation, SlidersHorizontal } from 'lucide-react'
import './AccountCustomization.css'

const categories = [
  ['appearance', 'Appearance', SlidersHorizontal],
  ['navigation', 'Navigation', Navigation],
  ['visibility', 'Visibility', Eye],
  ['tasks', 'Tasks', ListChecks],
  ['general', 'General', LayoutGrid],
]

export default function AccountCustomization({ appearance, navigation, visibility, tasks, general, initialCategory = 'appearance' }) {
  const [category, setCategory] = useState(initialCategory)
  const id = useId()
  const tabs = useRef([])
  const content = { appearance, navigation, visibility, tasks, general }

  return <div className="account-customization">
    <div className="account-customization-tabs" role="tablist" aria-label="Preference categories">
      {categories.map(([key, label, Icon], index) => <button key={key} ref={node => { tabs.current[index] = node }}
        id={id + '-' + key} aria-controls={id + '-panel-' + key}
        type="button" role="tab" aria-selected={category === key} tabIndex={category === key ? 0 : -1}
        onClick={() => setCategory(key)} onKeyDown={event => {
          const offsets = { ArrowLeft: -1, ArrowRight: 1 }
          if (!(event.key in offsets) && event.key !== 'Home' && event.key !== 'End') return
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1
            : (index + offsets[event.key] + categories.length) % categories.length
          setCategory(categories[next][0])
          tabs.current[next]?.focus()
        }}>
        <Icon size={16} aria-hidden="true"/>{label}
      </button>)}
    </div>
    {categories.map(([key]) => <div key={key} role="tabpanel" hidden={category !== key}
      id={id + '-panel-' + key} aria-labelledby={id + '-' + key}>
      <div className="account-settings-grid">{content[key]}</div>
    </div>)}
  </div>
}
