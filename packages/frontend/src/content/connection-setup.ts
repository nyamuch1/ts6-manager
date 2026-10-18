import type { TFunction } from 'i18next';
import { TS6_SERVER_DOCS, type SetupDocLink } from './teamspeak-docs';

export type DeploymentScenarioId =
  | 'same-host'
  | 'ts-docker-host-manager'
  | 'both-docker'
  | 'remote-ts'
  | 'manager-docker-remote-ts';

export interface DeploymentScenario {
  id: DeploymentScenarioId;
  label: string;
  description: string;
  hostPlaceholder: string;
  hostHint: string;
  notes?: string;
  docs?: readonly SetupDocLink[];
}

type DocLabelKey =
  | 'portsNetworking'
  | 'httpQuery'
  | 'quickstart'
  | 'dockerNetworking'
  | 'dockerCompose'
  | 'officialDocker'
  | 'portsFirewall'
  | 'securityBestPractices'
  | 'querySecurity'
  | 'queryAuthentication'
  | 'sshQuerySetup'
  | 'queryOverview'
  | 'sshQueryEnable'
  | 'setServeradminPassword'
  | 'httpQueryTs6'
  | 'portsDockerSetup'
  | 'firewallSecurity'
  | 'httpsWebquery'
  | 'ts6ServerDocs';

interface DocDefinition {
  labelKey: DocLabelKey;
  url: string;
}

const doc = (labelKey: DocLabelKey, url: string): DocDefinition => ({ labelKey, url });

function localizeDocs(t: TFunction, docs?: readonly DocDefinition[]): SetupDocLink[] | undefined {
  return docs?.map((entry) => ({
    label: t(`content:docLinks.${entry.labelKey}`),
    url: entry.url,
  }));
}

interface DeploymentScenarioDefinition {
  id: DeploymentScenarioId;
  hostPlaceholder: string;
  hasNotes?: boolean;
  docs?: readonly DocDefinition[];
}

const DEPLOYMENT_SCENARIO_DEFINITIONS: readonly DeploymentScenarioDefinition[] = [
  {
    id: 'same-host',
    hostPlaceholder: '127.0.0.1',
    docs: [
      doc('portsNetworking', TS6_SERVER_DOCS.portsNetworking),
      doc('httpQuery', TS6_SERVER_DOCS.httpQuery),
    ],
  },
  {
    id: 'ts-docker-host-manager',
    hostPlaceholder: 'teamspeak',
    docs: [
      doc('quickstart', TS6_SERVER_DOCS.quickstart),
      doc('dockerNetworking', TS6_SERVER_DOCS.portsNetworking),
    ],
  },
  {
    id: 'both-docker',
    hostPlaceholder: 'teamspeak',
    hasNotes: true,
    docs: [
      doc('dockerCompose', TS6_SERVER_DOCS.portsNetworking),
      doc('officialDocker', TS6_SERVER_DOCS.githubDocker),
    ],
  },
  {
    id: 'remote-ts',
    hostPlaceholder: 'ts.example.com',
    docs: [
      doc('portsFirewall', TS6_SERVER_DOCS.portsNetworking),
      doc('securityBestPractices', TS6_SERVER_DOCS.security),
    ],
  },
  {
    id: 'manager-docker-remote-ts',
    hostPlaceholder: 'ts.example.com',
    docs: [
      doc('portsNetworking', TS6_SERVER_DOCS.portsNetworking),
      doc('httpQuery', TS6_SERVER_DOCS.httpQuery),
    ],
  },
];

/** Resolves deployment scenarios in the active language. */
export function getDeploymentScenarios(t: TFunction): DeploymentScenario[] {
  return DEPLOYMENT_SCENARIO_DEFINITIONS.map((definition) => {
    const notes = definition.hasNotes
      ? t(`content:scenarios.${definition.id}.notes`)
      : undefined;
    return {
      id: definition.id,
      label: t(`content:scenarios.${definition.id}.label`),
      description: t(`content:scenarios.${definition.id}.description`),
      hostPlaceholder: definition.hostPlaceholder,
      hostHint: t(`content:scenarios.${definition.id}.hostHint`),
      ...(notes ? { notes } : {}),
      docs: localizeDocs(t, definition.docs),
    };
  });
}

export const FIELD_HELP_FIELDS = [
  'name',
  'host',
  'webqueryPort',
  'apiKey',
  'useHttps',
  'sshPort',
  'sshUsername',
  'sshPassword',
  'metricsEnabled',
  'metricsPort',
  'metricsHost',
] as const;

export type FieldHelpField = (typeof FIELD_HELP_FIELDS)[number];

export interface FieldHelpEntry {
  id: FieldHelpField;
  label: string;
  help: string;
}

/** Resolves the form field reference in the active language. */
export function getFieldHelp(t: TFunction): Record<FieldHelpField, FieldHelpEntry> {
  return Object.fromEntries(
    FIELD_HELP_FIELDS.map((field) => [
      field,
      {
        id: field,
        label: t(`content:fieldHelp.${field}.referenceLabel`),
        help: t(`content:fieldHelp.${field}.help`),
      },
    ]),
  ) as Record<FieldHelpField, FieldHelpEntry>;
}

export type FeatureTransport = 'WebQuery' | 'SSH';

export interface FeatureMatrixRow {
  feature: string;
  transport: FeatureTransport;
}

const FEATURE_MATRIX_DEFINITIONS: ReadonlyArray<{
  key: string;
  transport: FeatureTransport;
}> = [
  { key: 'dashboard', transport: 'WebQuery' },
  { key: 'virtualServers', transport: 'WebQuery' },
  { key: 'botFlowActions', transport: 'WebQuery' },
  { key: 'fileBrowser', transport: 'SSH' },
  { key: 'botEventTriggers', transport: 'SSH' },
  { key: 'musicCommands', transport: 'SSH' },
];

/** Resolves the feature/transport matrix in the active language. */
export function getFeatureMatrix(t: TFunction): FeatureMatrixRow[] {
  return FEATURE_MATRIX_DEFINITIONS.map((row) => ({
    feature: t(`content:featureMatrix.${row.key}`),
    transport: row.transport,
  }));
}

export type TsPrepStepId =
  | 'webquery-port'
  | 'guest-query'
  | 'bootstrap-api-key'
  | 'api-key'
  | 'ssh'
  | 'firewall';

export interface TsPrepStep {
  id: TsPrepStepId;
  title: string;
  body: string;
  code?: string;
  docs?: readonly SetupDocLink[];
}

interface TsPrepStepDefinition {
  id: TsPrepStepId;
  code?: string;
  docs?: readonly DocDefinition[];
}

const TS_PREP_STEP_DEFINITIONS: readonly TsPrepStepDefinition[] = [
  {
    id: 'webquery-port',
    docs: [
      doc('httpQueryTs6', TS6_SERVER_DOCS.httpQuery),
      doc('portsDockerSetup', TS6_SERVER_DOCS.portsNetworking),
    ],
  },
  {
    id: 'guest-query',
    docs: [doc('querySecurity', TS6_SERVER_DOCS.security)],
    code: 'TSSERVER_QUERY_HTTP_ALLOW_GUEST=0\nTSSERVER_QUERY_SSH_ALLOW_GUEST=0',
  },
  {
    id: 'bootstrap-api-key',
    docs: [doc('queryAuthentication', TS6_SERVER_DOCS.authentication)],
    code: 'TSSERVER_QUERY_ADMIN_API_KEY=<secure-stable-key>',
  },
  {
    id: 'api-key',
    code: 'use 1\napikeyadd scope=manage lifetime=0 ip=0.0.0.0/0',
    docs: [
      doc('sshQuerySetup', TS6_SERVER_DOCS.sshQuery),
      doc('queryAuthentication', TS6_SERVER_DOCS.authentication),
      doc('queryOverview', TS6_SERVER_DOCS.queryOverview),
    ],
  },
  {
    id: 'ssh',
    docs: [
      doc('sshQueryEnable', TS6_SERVER_DOCS.sshQuery),
      doc('setServeradminPassword', TS6_SERVER_DOCS.authentication),
    ],
  },
  {
    id: 'firewall',
    docs: [
      doc('portsNetworking', TS6_SERVER_DOCS.portsNetworking),
      doc('firewallSecurity', TS6_SERVER_DOCS.security),
    ],
  },
];

function localizePrepStep(t: TFunction, definition: TsPrepStepDefinition): TsPrepStep {
  const docs = localizeDocs(t, definition.docs);
  return {
    id: definition.id,
    title: t(`content:prepSteps.${definition.id}.title`),
    body: t(`content:prepSteps.${definition.id}.body`),
    ...(definition.code ? { code: definition.code } : {}),
    ...(docs ? { docs } : {}),
  };
}

/** Resolves all TeamSpeak preparation steps in the active language. */
export function getTsPrepSteps(t: TFunction): TsPrepStep[] {
  return TS_PREP_STEP_DEFINITIONS.map((definition) => localizePrepStep(t, definition));
}

/** Resolves one TeamSpeak preparation step in the active language. */
export function getTsPrepStep(t: TFunction, id: TsPrepStepId): TsPrepStep {
  const definition = TS_PREP_STEP_DEFINITIONS.find((step) => step.id === id);
  if (!definition) {
    throw new Error(`Unknown TeamSpeak prep step: ${id}`);
  }
  return localizePrepStep(t, definition);
}

export const CHECKLIST_ITEM_IDS = [
  'webquery-enabled',
  'api-key-created',
  'connection-added',
  'webquery-tested',
  'ssh-configured',
] as const;

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  manual: boolean;
}

const CHECKLIST_MANUAL_BY_ID: Record<ChecklistItemId, boolean> = {
  'webquery-enabled': true,
  'api-key-created': true,
  'connection-added': false,
  'webquery-tested': false,
  'ssh-configured': false,
};

/** Resolves the setup checklist in the active language. */
export function getChecklistItems(t: TFunction): ChecklistItem[] {
  return CHECKLIST_ITEM_IDS.map((id) => ({
    id,
    label: t(`content:checklist.${id}`),
    manual: CHECKLIST_MANUAL_BY_ID[id],
  }));
}

export const CHECKLIST_STORAGE_KEY = 'ts6-connection-setup-checklist';
export const NUDGE_DISMISS_STORAGE_KEY = 'ts6-connection-nudge-dismissed';

export const DEFAULT_CONNECTION_FORM = {
  name: '',
  host: '',
  webqueryPort: '10080',
  apiKey: '',
  useHttps: false,
  sshPort: '10022',
  sshUsername: '',
  sshPassword: '',
  metricsEnabled: false,
  metricsPort: '9187',
  metricsHost: '',
};

export type ConnectionFormState = typeof DEFAULT_CONNECTION_FORM;
