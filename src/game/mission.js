import { BEACON, TERMINAL } from '../world/layout'

export const MISSION = {
  code: 'MISSION 01',
  title: 'The Silent Outpost',
  location: 'Kepler Outpost-9 · Frontier Sector Theta',
  stages: {
    deploy: { objective: 'Investigate the command module terminal' },
    encounter: { objective: 'Neutralize the security droid' },
    extract: { objective: 'Reach the extraction beacon' },
    complete: { objective: 'Extraction confirmed' },
  },
}

export const BRIEFING = [
  { at: 600, speaker: 'COMMAND', text: 'Operative, you are on the ground at Outpost-9. No signal from the colony for nineteen days.' },
  { at: 6200, speaker: 'COMMAND', text: 'Reach the command module terminal and pull whatever the station logged before it went dark.' },
]

export const TRANSMISSIONS = {
  terminal: { speaker: 'TERMINAL', text: 'SECURITY OVERRIDE ACCEPTED. Unregistered personnel detected. Dispatching K7.' },
  activate: { speaker: 'COMMAND', text: 'That droid has you flagged as hostile. Put it down. Evade or guard its strikes, and use the blade to break its balance.' },
  enraged: { speaker: 'SYSTEM', text: 'K7 core overheating. Attack frequency increasing.' },
  destroyed: { speaker: 'COMMAND', text: 'Threat neutralized. Extraction beacon is live past the north wall. Move.' },
  hazard: { speaker: 'SUIT', text: 'Warning: exposed power conduit. Arc discharge detected.' },
  lowHealth: { speaker: 'SUIT', text: 'Vitals critical. Break line of sight.' },
}

// Environmental storytelling: short logs scattered around the outpost.
export const LOGS = {
  'log-1': {
    title: 'Supply Officer Reyes — Day 212',
    body: 'The relay keeps pinging something in the ridge, a signal older than the colony charter. Director says ignore it. The droids started their patrol loops at 0300 again, nobody scheduled that.',
  },
  'log-2': {
    title: 'Maintenance Ticket #4471',
    body: 'K-series firmware updated itself overnight. Source: unknown. Target designation table now lists every colonist as "foreign." Requesting manual shutdown authority. Request denied.',
  },
  'log-3': {
    title: 'Director Vasquez — Final Entry',
    body: 'We have moved everyone to the ridge caves. The machines are guarding the echo, not us. If Central sends someone, tell them: do not dig.',
  },
}

/** World-space target for the current objective (x, z), or null. */
export function objectiveTarget(stage, droidPosition) {
  switch (stage) {
    case 'deploy':
      return TERMINAL
    case 'encounter':
      return droidPosition
    case 'extract':
      return BEACON
    default:
      return null
  }
}
