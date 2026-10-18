import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Tiny helper: one placeholder row                                  */
/* ------------------------------------------------------------------ */
function P({ code, desc, example }: { code: string; desc: string; example?: string }) {
  return (
    <div className="py-1.5 grid grid-cols-[1fr_1.4fr_1.6fr] gap-2 items-start text-xs border-b border-border/40 last:border-0">
      <code className="text-[11px] font-mono text-emerald-400 break-all">{code}</code>
      <span className="text-muted-foreground">{desc}</span>
      {example ? (
        <code className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 rounded px-1.5 py-0.5 break-all">{example}</code>
      ) : <span />}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1.5 first:mt-0"><Badge variant="outline" className="text-[10px]">{children}</Badge></div>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function PlaceholderReference({ open, onOpenChange }: Props) {
  const { t } = useTranslation('bots');
  const desc = (key: string) => t(`placeholderReference.desc.${key}`);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl !grid-rows-none !block p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base">{t('placeholderReference.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t('placeholderReference.intro', { token: '{{placeholder}}' })}
          </p>
        </DialogHeader>

        <Tabs defaultValue="event" className="px-5 pb-5">
          <TabsList className="h-8 mb-3">
            <TabsTrigger value="event" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.event')}</TabsTrigger>
            <TabsTrigger value="time" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.time')}</TabsTrigger>
            <TabsTrigger value="var" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.variables')}</TabsTrigger>
            <TabsTrigger value="temp" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.temp')}</TabsTrigger>
            <TabsTrigger value="exec" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.exec')}</TabsTrigger>
            <TabsTrigger value="filter" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.filter')}</TabsTrigger>
            <TabsTrigger value="functions" className="text-xs px-2.5 h-6">{t('placeholderReference.tabs.functions')}</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[58vh]">
            {/* ========== EVENT ========== */}
            <TabsContent value="event" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.eventIntro')}
              </p>

              <SectionHeader>{t('placeholderReference.sections.clientConnected', { event: 'notifycliententerview' })}</SectionHeader>
              <P code="{{event.clid}}" desc={desc('clientId')} example='Move client #{{event.clid}} to channel' />
              <P code="{{event.client_nickname}}" desc={desc('nickname')} example='Welcome {{event.client_nickname}}!' />
              <P code="{{event.client_database_id}}" desc={desc('databaseId')} example='DB-ID: {{event.client_database_id}}' />
              <P code="{{event.client_unique_identifier}}" desc={desc('uniqueId')} example='UID: {{event.client_unique_identifier}}' />
              <P code="{{event.client_type}}" desc={desc('typeUserQuery')} example='Condition: event.client_type == 0' />
              <P code="{{event.client_servergroups}}" desc={desc('serverGroupIds')} example="contains(event.client_servergroups, '6')" />
              <P code="{{event.connection_client_ip}}" desc={desc('ipAddress')} example='VPN check: https://api.vpn.io/{{event.connection_client_ip}}' />
              <P code="{{event.cid}}" desc={desc('channelJoined')} example='Condition: event.cid == 42' />

              <SectionHeader>{t('placeholderReference.sections.clientDisconnected', { event: 'notifyclientleftview' })}</SectionHeader>
              <P code="{{event.clid}}" desc={desc('clientId')} />
              <P code="{{event.cfid}}" desc={desc('channelWasIn')} />
              <P code="{{event.reasonid}}" desc={desc('reasonLostKickBanLeave')} example='Condition: event.reasonid == 5' />
              <P code="{{event.reasonmsg}}" desc={desc('reasonMessage')} example='Kicked: {{event.reasonmsg}}' />
              <P code="{{event.client_nickname}}" desc={desc('nicknameEnriched')} example='{{event.client_nickname}} left TeamSpeak' />
              <P code="{{event.client_type}}" desc={desc('typeUserQueryKnown')} example='Condition: event.client_type == 0' />
              <P code="{{event.client_database_id}}" desc={desc('databaseIdKnown')} />
              <P code="{{event.client_unique_identifier}}" desc={desc('uniqueIdKnown')} />
              <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                {t('placeholderReference.leaveNote')}
              </p>

              <SectionHeader>{t('placeholderReference.sections.clientMoved', { event: 'notifyclientmoved' })}</SectionHeader>
              <P code="{{event.clid}}" desc={desc('clientId')} />
              <P code="{{event.ctid}}" desc={desc('targetChannelId')} example='Condition: event.ctid == 10' />
              <P code="{{event.cfid}}" desc={desc('sourceChannelId')} />
              <P code="{{event.reasonid}}" desc={desc('reasonSelfMovedByAdmin')} />

              <SectionHeader>{t('placeholderReference.sections.textMessage', { event: 'notifytextmessage' })}</SectionHeader>
              <P code="{{event.clid}}" desc={desc('senderClientId')} />
              <P code="{{event.client_nickname}}" desc={desc('senderNickname')} />
              <P code="{{event.msg}}" desc={desc('messageText')} example='User wrote: {{event.msg}}' />
              <P code="{{event.targetmode}}" desc={desc('targetMode')} />

              <SectionHeader>{t('placeholderReference.sections.chatCommand', { event: 'trigger_command' })}</SectionHeader>
              <P code="{{event.command_name}}" desc={desc('commandName')} example='Command: {{event.command_name}}' />
              <P code="{{event.command_args}}" desc={desc('commandArgs')} example='Args: {{event.command_args}}' />
              <P code="{{event.clid}}" desc={desc('senderClientId')} />
              <P code="{{event.client_nickname}}" desc={desc('senderNickname')} />

              <SectionHeader>{t('placeholderReference.sections.channelEvents')}</SectionHeader>
              <P code="{{event.cid}}" desc={desc('channelId')} />
              <P code="{{event.invokerid}}" desc={desc('invokerClientId')} />
              <P code="{{event.invokername}}" desc={desc('invokerName')} />

              <SectionHeader>{t('placeholderReference.sections.webhook', { event: 'trigger_webhook' })}</SectionHeader>
              <P code="{{event.webhook_path}}" desc={desc('webhookPath')} example='/my-hook' />
              <P code="{{event.webhook_method}}" desc={desc('httpMethod')} example='GET or POST' />
              <P code="{{event.webhook_body}}" desc={desc('requestBodyRawJson')} />
              <P code="{{event.webhook_body.field}}" desc={desc('nestedField')} example='Status: {{event.webhook_body.status}}' />
              <P code="{{event.webhook_query}}" desc={desc('queryParamsRawJson')} />
            </TabsContent>

            {/* ========== TIME ========== */}
            <TabsContent value="time" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.timeIntro')}
              </p>
              <P code="{{time.time}}" desc={desc('timeFormatted')} example='Channel name: Es ist {{time.time}} Uhr' />
              <P code="{{time.date}}" desc={desc('dateFormatted')} example='Datum: {{time.date}}' />
              <P code="{{time.hours}}" desc={desc('hour')} example='Condition: time.hours >= 22' />
              <P code="{{time.minutes}}" desc={desc('minute')} />
              <P code="{{time.seconds}}" desc={desc('second')} />
              <P code="{{time.day}}" desc={desc('dayOfMonth')} />
              <P code="{{time.month}}" desc={desc('month')} example='Condition: time.month == 12' />
              <P code="{{time.year}}" desc={desc('year')} example='2026' />
              <P code="{{time.dayOfWeek}}" desc={desc('dayOfWeek')} example='Condition: time.dayOfWeek == 0' />
              <P code="{{time.timestamp}}" desc={desc('unixTimestamp')} example='1739462400' />
            </TabsContent>

            {/* ========== VARIABLES ========== */}
            <TabsContent value="var" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.varIntro')}
              </p>
              <P code={'{{var.name}}'} desc={desc('varRead')} example='Counter: {{var.visit_count}}' />

              <SectionHeader>{t('placeholderReference.sections.variableActions')}</SectionHeader>
              <div className="text-xs text-muted-foreground space-y-1 mt-1">
                <p>{t('placeholderReference.varActions.set')}</p>
                <p>{t('placeholderReference.varActions.increment')}</p>
                <p>{t('placeholderReference.varActions.append')}</p>
              </div>

              <SectionHeader>{t('placeholderReference.sections.useCaseExamples')}</SectionHeader>
              <div className="text-xs text-muted-foreground space-y-1 mt-1">
                <p>{t('placeholderReference.varUseCases.visitCounter', { variable: 'visit_count' })}</p>
                <p>{t('placeholderReference.varUseCases.lastSeen', { key: 'lastseen_{{event.client_database_id}}', value: '{{time.timestamp}}' })}</p>
                <p>{t('placeholderReference.varUseCases.onlineTime', { variable: 'onlinetime_{{event.clid}}' })}</p>
              </div>
            </TabsContent>

            {/* ========== TEMP ========== */}
            <TabsContent value="temp" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.tempIntro')}
              </p>

              <SectionHeader>{t('placeholderReference.sections.autoSet')}</SectionHeader>
              <P code="{{temp.lastCreatedChannelId}}" desc={desc('tempLastCreated')} example='Move client to {{temp.lastCreatedChannelId}}' />
              <P code="{{temp.lastResult}}" desc={desc('tempLastResult')} />
              <P code="{{temp.afkMovedCount}}" desc={desc('tempAfkMoved')} example='Moved {{temp.afkMovedCount}} AFK users' />
              <P code="{{temp.idleKickedCount}}" desc={desc('tempIdleKicked')} />
              <P code="{{temp.pokedCount}}" desc={desc('tempPoked')} />
              <P code="{{temp.rankPromotedCount}}" desc={desc('tempRankPromoted')} />
              <P code="{{temp.tempChannelsDeleted}}" desc={desc('tempChannelsDeleted')} />

              <SectionHeader>{t('placeholderReference.sections.customStoreAs')}</SectionHeader>
              <p className="text-xs text-muted-foreground mb-1">
                {t('placeholderReference.storeAsIntro')}
              </p>
              <P code={'{{temp.server.virtualserver_clientsonline}}'} desc={desc('tempServerOnline')} example='Online: {{temp.server.virtualserver_clientsonline}}/{{temp.server.virtualserver_maxclients}}' />
              <P code={'{{temp.server.virtualserver_uptime}}'} desc={desc('tempServerUptime')} example='Uptime: {{temp.server.virtualserver_uptime|uptime}}' />
              <P code={'{{temp.client.client_nickname}}'} desc={desc('tempClientName')} />
            </TabsContent>

            {/* ========== EXEC ========== */}
            <TabsContent value="exec" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.execIntro')}
              </p>
              <P code="{{exec.flowId}}" desc={desc('execFlowId')} />
              <P code="{{exec.executionId}}" desc={desc('execExecutionId')} />
              <P code="{{exec.configId}}" desc={desc('execConfigId')} />
              <P code="{{exec.sid}}" desc={desc('execSid')} />
              <P code="{{exec.triggerType}}" desc={desc('execTriggerType')} example='Condition: exec.triggerType == "cron"' />
            </TabsContent>

            {/* ========== FILTER ========== */}
            <TabsContent value="filter" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.filterIntro', { token: '{{value|filter}}' })}
              </p>
              <P code="uptime" desc={desc('filterUptime')} example='{{temp.server.virtualserver_uptime|uptime}} → "5d 3h 42m"' />
              <P code="round" desc={desc('filterRound')} example='{{temp.value|round}} → "42"' />
              <P code="floor" desc={desc('filterFloor')} example='{{temp.value|floor}} → "41"' />
              <P code="dropFirst" desc={desc('filterDropFirst')} example='{{event.command_args|dropFirst}}' />
            </TabsContent>

            {/* ========== FUNCTIONS ========== */}
            <TabsContent value="functions" className="mt-0 pr-3">
              <p className="text-xs text-muted-foreground mb-2">
                {t('placeholderReference.functionsIntro')}
              </p>
              <P code="contains(str, sub)" desc={desc('fnContains')} example="contains(event.client_servergroups, '6')" />
              <P code="startsWith(str, prefix)" desc={desc('fnStartsWith')} example="startsWith(event.client_nickname, 'Admin')" />
              <P code="endsWith(str, suffix)" desc={desc('fnEndsWith')} example="endsWith(event.client_nickname, 'Bot')" />
              <P code="lower(str)" desc={desc('fnLower')} example="contains(lower(event.client_nickname), 'bot')" />
              <P code="upper(str)" desc={desc('fnUpper')} />
              <P code="length(str)" desc={desc('fnLength')} example="length(event.msg) > 100" />
              <P code="split(str, sep, idx)" desc={desc('fnSplit')} example="split(event.command_args, ' ', 0)" />
              <P code="dropFirst(str)" desc={desc('fnDropFirst')} example="length(dropFirst(event.command_args)) > 0" />

              <SectionHeader>{t('placeholderReference.sections.conditionExamples')}</SectionHeader>
              <div className="text-xs text-muted-foreground space-y-1 mt-1">
                <p><code className="text-emerald-400">event.client_type == 0</code> &mdash; {t('placeholderReference.conditionExamples.realUsers')}</p>
                <p><code className="text-emerald-400">{"contains(event.client_servergroups, '7')"}</code> &mdash; {t('placeholderReference.conditionExamples.inGroup7')}</p>
                <p><code className="text-emerald-400">time.hours {'>='} 22 or time.hours {'<'} 6</code> &mdash; {t('placeholderReference.conditionExamples.nighttime')}</p>
                <p><code className="text-emerald-400">event.ctid == 42</code> &mdash; {t('placeholderReference.conditionExamples.specificChannel')}</p>
                <p><code className="text-emerald-400">temp.vpn.security.vpn == 1</code> &mdash; {t('placeholderReference.conditionExamples.vpnDetected')}</p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
