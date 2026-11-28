import { useState } from 'react'
import { Layers, Pin, Plus } from 'lucide-react'
import { navigationPages, defaultNavigationPins } from './AppNavigation'
import { featureVisible } from '../lib/featureVisibility'
import { defaultWorkspace, workspaceId } from '../lib/workspace'

const presets = {
  copy: { name: 'Copy current profile' },
  class: { name: 'Class', pins: ['workspace', 'tasks', 'calendar', 'documents', 'canvas'] },
  exams: { name: 'Exams', pins: ['workspace', 'tasks', 'calendar', 'study'] },
  applications: { name: 'Job applications', pins: ['workspace', 'jobs', 'resumes', 'cover-letters', 'prep'] },
}

export default function WorkspaceProfiles({ store, navigationPins, hiddenFeatures, width, locked, onConfirm }) {
  const { library, active, changeProfiles } = store
  const [panel, setPanel] = useState(null)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('copy')
  const [pinFilter, setPinFilter] = useState('')
  const basePins = navigationPins ?? defaultNavigationPins
  const pins = active.pins ?? basePins
  const cleanName = name.trim()
  const matchingName = library.profiles.some(profile => (panel !== 'rename' || profile.id !== active.id) &&
    profile.name.toLowerCase() === cleanName.toLowerCase())

  function updateProfile(patch) {
    changeProfiles(previous => ({ ...previous, profiles: previous.profiles.map(profile => profile.id === active.id ? { ...profile, ...patch } : profile) }))
  }

  function submit(event) {
    event.preventDefault()
    if (!cleanName || matchingName || locked) return
    if (panel === 'rename') updateProfile({ name: cleanName })
    else if (library.profiles.length < 8) {
      const profile = {
        id: workspaceId(), name: cleanName,
        layout: preset === 'copy' ? active.layout : defaultWorkspace(preset, cleanName, width),
        pins: preset === 'copy' ? [...pins] : [...presets[preset].pins],
      }
      changeProfiles(previous => ({ activeProfileId: profile.id, profiles: [...previous.profiles, profile] }))
    }
    setPanel(null)
  }

  const show = next => {
    setPanel(panel === next ? null : next)
    setPreset('copy')
    setName(next === 'rename' ? active.name : '')
  }

  const remove = () => onConfirm('Delete the ' + active.name + ' profile and its workspace notes?', () => {
    changeProfiles(previous => {
      const profiles = previous.profiles.filter(profile => profile.id !== active.id)
      return profiles.length ? { profiles, activeProfileId: profiles[0].id } : previous
    })
    setPanel(null)
  })

  return <section className="workspace-profile-controls" aria-label="Workspace profiles">
    <div className="workspace-profile-bar">
      <label><Layers size={16} aria-hidden="true"/>Profile
        <select value={active.id} onChange={event => {
          setPanel(null)
          const id = event.target.value
          changeProfiles(previous => ({ ...previous, activeProfileId: id }))
        }}>{library.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
      </label>
      <button type="button" onClick={() => show('new')} disabled={locked || library.profiles.length >= 8}><Plus size={14}/>New profile</button>
      <button type="button" disabled={locked} aria-expanded={panel === 'pins'} onClick={() => { setPinFilter(''); show('pins') }}><Pin size={14}/>Pinned pages</button>
      <button type="button" disabled={locked} onClick={() => show('rename')}>Rename</button>
      <button type="button" disabled={locked || library.profiles.length === 1} onClick={remove}>Delete profile</button>
    </div>
    {(panel === 'rename' || panel === 'new') && <form className="workspace-profile-bar" onSubmit={submit}>
      {panel === 'new' && <label>Start with<select value={preset} onChange={event => {
        const value = event.target.value
        setPreset(value)
        setName(value === 'copy' ? '' : presets[value].name)
      }}>{Object.entries(presets).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>}
      <label>Profile name<input autoFocus required maxLength={60} value={name} placeholder="e.g. Fall classes" onChange={event => setName(event.target.value)}/></label>
      <button type="submit" disabled={locked || !cleanName || matchingName}>{panel === 'new' ? 'Create profile' : 'Save name'}</button>
      <button type="button" onClick={() => setPanel(null)}>Cancel</button>
      {matchingName && <small>That name is already in use.</small>}
    </form>}
    {panel === 'pins' && <div className="workspace-profile-pins">
      <div className="workspace-profile-bar">
        <label>Find a page<input type="search" value={pinFilter} onChange={event => setPinFilter(event.target.value)}/></label>
        <button type="button" disabled={locked || active.pins === null} onClick={() => updateProfile({ pins: null })}>Use account pins</button>
        <small>{active.pins === null ? 'Using your account’s navigation pins.' : 'Changes apply to the navigation bar in this profile.'}</small>
      </div>
      <div className="workspace-profile-pin-list">
        {navigationPages.filter(([id, label]) => featureVisible(hiddenFeatures, id) && label.toLowerCase().includes(pinFilter.trim().toLowerCase()))
          .map(([id, label]) => <label key={id}><input type="checkbox" checked={pins.includes(id)} disabled={locked}
            onChange={event => updateProfile({ pins: event.target.checked ? [...pins, id] : pins.filter(item => item !== id) })}/>{label}</label>)}
      </div>
    </div>}
  </section>
}
