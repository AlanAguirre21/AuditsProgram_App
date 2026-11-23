/** TanStack Query keys in one place. */
export const qk = {
  me: ['me'],
  dashboard: ['dashboard'],
  program: (year, filters) => ['program', year, filters],
  audits: (filters) => ['audits', filters],
  auditsMeta: (year) => ['audits', 'meta', year],
  audit: (id) => ['audit', id],
  occurrences: (filters) => ['occurrences', filters],
  myOccurrences: ['occurrences', 'mine'],
  occurrence: (id) => ['occurrence', id],
  occurrenceHistory: (id) => ['occurrence', id, 'history'],
  validations: ['validations'],
  users: (filters) => ['users', filters],
  usersLookup: ['users', 'lookup'],
  user: (id) => ['user', id],
  groups: (filters) => ['groups', filters],
  group: (id) => ['group', id],
  calendar: (year) => ['calendar', year],
  changelog: (filters) => ['changelog', filters],
  importPreview: (id) => ['import', id],
  compliance: (year, groupBy) => ['compliance', year, groupBy],
  notificationRules: ['notification-rules'],
  notificationLog: (filters) => ['notification-log', filters],
  occurrenceNotifications: (id) => ['occurrence', id, 'notifications'],
  settings: ['settings'],
};

/** Prefixes invalidated after any occurrence mutation. */
export const OCCURRENCE_RELATED = [['occurrence'], ['occurrences'], ['program'], ['dashboard'], ['validations'], ['audit'], ['audits'], ['compliance']];
