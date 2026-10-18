import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBot, useUpdateBot } from '@/hooks/use-bots';
import { useChatCommands } from '@/hooks/use-chat-commands';
import { useFlowCommandTriggers } from '@/hooks/use-flow-command-triggers';
import { clashesForCommand, describeCommandClash } from '@/lib/command-clashes';
import { BUILTIN_CHAT_COMMANDS } from '@ts6/common';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Save, HelpCircle, Zap, MessageSquare, Ban, UserX, ArrowRightLeft,
  Clock, GitBranch, Variable, FileText, Webhook, Terminal, Plus, Trash2,
  Bell, PenLine, FolderPlus, FolderMinus, Users, Globe, Send,
  Moon, Timer, Megaphone, Award, Shield,
  Music, Volume2, LogIn, LogOut, Pause, SkipForward, Navigation, Mic, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PlaceholderReference } from '@/components/bots/PlaceholderReference';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  buildOrthogonalRoute,
  computeCanvasExtent,
  createFlowSnapshot,
  flowSnapshotsEqual,
  NODE_HEIGHT,
  NODE_WIDTH,
  type FlowEdge,
  type FlowNode,
  type FlowSnapshot,
} from '@/lib/bot-flow';

// --- Node type definitions ---
type HandleConfig = {
  inputs: string[];   // named input ports
  outputs: string[];  // named output ports
};

interface NodeTypeDef {
  type: string;
  labelKey: string;
  icon: React.ElementType;
  color: string;
  handles: HandleConfig;
}

const TRIGGER_NODES: NodeTypeDef[] = [
  { type: 'trigger_event', labelKey: 'editor.nodes.tsEvent', icon: Zap, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_cron', labelKey: 'editor.nodes.cronTimer', icon: Clock, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_webhook', labelKey: 'editor.nodes.webhook', icon: Webhook, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', handles: { inputs: [], outputs: ['out'] } },
  { type: 'trigger_command', labelKey: 'editor.nodes.chatCommand', icon: Terminal, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', handles: { inputs: [], outputs: ['out'] } },
];

const ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_message', labelKey: 'editor.nodes.sendMessage', icon: MessageSquare, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_poke', labelKey: 'editor.nodes.pokeClient', icon: Bell, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_kick', labelKey: 'editor.nodes.kickClient', icon: UserX, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_ban', labelKey: 'editor.nodes.banClient', icon: Ban, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_move', labelKey: 'editor.nodes.moveClient', icon: ArrowRightLeft, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelCreate', labelKey: 'editor.nodes.createChannel', icon: FolderPlus, color: 'bg-green-500/20 text-green-400 border-green-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelEdit', labelKey: 'editor.nodes.editChannel', icon: PenLine, color: 'bg-green-500/20 text-green-400 border-green-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_channelDelete', labelKey: 'editor.nodes.deleteChannel', icon: FolderMinus, color: 'bg-red-500/20 text-red-400 border-red-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_groupAdd', labelKey: 'editor.nodes.addToGroup', icon: Users, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_groupRemove', labelKey: 'editor.nodes.removeFromGroup', icon: Users, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_webquery', labelKey: 'editor.nodes.webQuery', icon: Terminal, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_webhook', labelKey: 'editor.nodes.webhook', icon: Send, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_httpRequest', labelKey: 'editor.nodes.httpRequest', icon: Globe, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const VOICE_ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_voicePlay', labelKey: 'editor.nodes.voicePlay', icon: Music, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceStop', labelKey: 'editor.nodes.voiceStop', icon: Music, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceJoinChannel', labelKey: 'editor.nodes.voiceJoin', icon: LogIn, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceLeaveChannel', labelKey: 'editor.nodes.voiceLeave', icon: LogOut, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceVolume', labelKey: 'editor.nodes.voiceVolume', icon: Volume2, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voicePauseResume', labelKey: 'editor.nodes.voicePauseResume', icon: Pause, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceSkip', labelKey: 'editor.nodes.voiceSkip', icon: SkipForward, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceSeek', labelKey: 'editor.nodes.voiceSeek', icon: Navigation, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_voiceTts', labelKey: 'editor.nodes.voiceTts', icon: Mic, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const SMART_ACTION_NODES: NodeTypeDef[] = [
  { type: 'action_afkMover', labelKey: 'editor.nodes.afkMover', icon: Moon, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_idleKicker', labelKey: 'editor.nodes.idleKicker', icon: Timer, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_pokeGroup', labelKey: 'editor.nodes.pokeGroup', icon: Megaphone, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_rankCheck', labelKey: 'editor.nodes.rankCheck', icon: Award, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_tempChannelCleanup', labelKey: 'editor.nodes.tempCleanup', icon: Trash2, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_animatedChannel', labelKey: 'editor.nodes.animatedChannel', icon: Sparkles, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', handles: { inputs: [], outputs: [] } },
];

const LOGIC_NODES: NodeTypeDef[] = [
  { type: 'condition', labelKey: 'editor.nodes.condition', icon: GitBranch, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', handles: { inputs: ['in'], outputs: ['true', 'false'] } },
  { type: 'delay', labelKey: 'editor.nodes.delay', icon: Clock, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'variable', labelKey: 'editor.nodes.setVariable', icon: Variable, color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'log', labelKey: 'editor.nodes.log', icon: FileText, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
  { type: 'action_generateCode', labelKey: 'editor.nodes.generateCode', icon: Sparkles, color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', handles: { inputs: ['in'], outputs: ['out'] } },
];

const ALL_NODE_TYPES: NodeTypeDef[] = [...TRIGGER_NODES, ...ACTION_NODES, ...VOICE_ACTION_NODES, ...SMART_ACTION_NODES, ...LOGIC_NODES];

const NODE_CATEGORIES = [
  { labelKey: 'editor.categories.triggers', nodes: TRIGGER_NODES },
  { labelKey: 'editor.categories.actions', nodes: ACTION_NODES },
  { labelKey: 'editor.categories.voice', nodes: VOICE_ACTION_NODES },
  { labelKey: 'editor.categories.smartActions', nodes: SMART_ACTION_NODES },
  { labelKey: 'editor.categories.logic', nodes: LOGIC_NODES },
];

function getNodeMeta(type: string): NodeTypeDef | undefined {
  return ALL_NODE_TYPES.find((n) => n.type === type);
}

// --- Constants ---
const NODE_W = NODE_WIDTH;
const NODE_H = NODE_HEIGHT;
const HANDLE_R = 6;

// Calculate handle positions (absolute coords on canvas)
function getOutputHandlePos(node: FlowNode, portIndex: number, portCount: number) {
  const spacing = NODE_H / (portCount + 1);
  return { x: node.x + NODE_W, y: node.y + spacing * (portIndex + 1) };
}

function getInputHandlePos(node: FlowNode, portIndex: number, portCount: number) {
  const spacing = NODE_H / (portCount + 1);
  return { x: node.x, y: node.y + spacing * (portIndex + 1) };
}

// --- Types ---
/** Render the flow editor and live command-trigger clash warnings. */
export default function BotEditor() {
  const { t } = useTranslation('bots');
  const { botId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: bot, isLoading } = useBot(botId ? parseInt(botId) : null);
  const { data: customCommands } = useChatCommands(bot?.serverConfigId ?? null);
  const flowCommandNames = useFlowCommandTriggers(bot?.serverConfigId ?? null);
  const updateBot = useUpdateBot();

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [botName, setBotName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [savedBaseline, setSavedBaseline] = useState<FlowSnapshot | null>(null);
  const savedBaselineRef = useRef<FlowSnapshot | null>(null);
  const acceptedServerSnapshotRef = useRef<FlowSnapshot | null>(null);
  const saveInFlightRef = useRef(false);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Connection state
  const [connectFrom, setConnectFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const currentSnapshot = useMemo(() => botId
    ? createFlowSnapshot(parseInt(botId), botName, nodes, edges)
    : null, [botId, botName, nodes, edges]);
  const isDirty = Boolean(currentSnapshot && savedBaseline && !flowSnapshotsEqual(currentSnapshot, savedBaseline));

  const requestNavigation = useCallback((to: string) => {
    if (!isDirty) {
      navigate(to);
      return;
    }
    setPendingNavigation(to);
    setShowDiscardDialog(true);
  }, [isDirty, navigate]);

  // BrowserRouter does not expose a supported history blocker. Capture normal
  // internal links and use the shared confirmation UI; browser Back remains a
  // documented limitation until a data-router migration is justified.
  useEffect(() => {
    const handleInternalLink = (event: MouseEvent) => {
      if (!isDirty) return;
      const target = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return;
      const href = new URL(target.href, window.location.href);
      if (href.origin !== window.location.origin) return;
      const destination = `${href.pathname}${href.search}${href.hash}`;
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (destination === current) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(destination);
      setShowDiscardDialog(true);
    };
    document.addEventListener('click', handleInternalLink, true);
    return () => document.removeEventListener('click', handleInternalLink, true);
  }, [isDirty, location]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateViewport = () => setCanvasViewport({ width: canvas.clientWidth, height: canvas.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Load only clean editors. A refetch is allowed to refresh a clean baseline,
  // but never replaces an in-progress draft.
  useEffect(() => {
    if (!bot || !botId || saveInFlightRef.current) return;
    const id = parseInt(botId);
    let flow: { nodes?: FlowNode[]; edges?: FlowEdge[] } = {};
    try { flow = typeof bot.flowData === 'string' ? JSON.parse(bot.flowData) : bot.flowData; } catch { /* legacy malformed data becomes an empty flow */ }
    const serverSnapshot = createFlowSnapshot(
      id,
      bot.name || '',
      flow.nodes || [],
      (flow.edges || []).map((edge: any) => ({ ...edge, sourcePort: edge.sourcePort || 'out', targetPort: edge.targetPort || 'in' })),
    );
    const baseline = savedBaselineRef.current;
    const current = currentSnapshot;
    if (!baseline || baseline.botId !== id) {
      savedBaselineRef.current = serverSnapshot;
      setSavedBaseline(serverSnapshot);
      acceptedServerSnapshotRef.current = null;
      setBotName(serverSnapshot.name);
      setNodes(serverSnapshot.nodes);
      setEdges(serverSnapshot.edges);
      return;
    }
    if (acceptedServerSnapshotRef.current && flowSnapshotsEqual(serverSnapshot, acceptedServerSnapshotRef.current)) {
      acceptedServerSnapshotRef.current = null;
    } else if (acceptedServerSnapshotRef.current) {
      return;
    }
    if (current && !flowSnapshotsEqual(current, baseline)) return;
    if (!flowSnapshotsEqual(serverSnapshot, baseline)) {
      savedBaselineRef.current = serverSnapshot;
      setSavedBaseline(serverSnapshot);
      setBotName(serverSnapshot.name);
      setNodes(serverSnapshot.nodes);
      setEdges(serverSnapshot.edges);
    }
  }, [bot, botId, currentSnapshot]);

  const handleSave = useCallback(() => {
    if (!botId || !currentSnapshot || saveInFlightRef.current) return;
    const snapshot = createFlowSnapshot(currentSnapshot.botId, currentSnapshot.name, currentSnapshot.nodes, currentSnapshot.edges);
    saveInFlightRef.current = true;
    setSaveInFlight(true);
    updateBot.mutate({
      id: snapshot.botId,
      data: { name: snapshot.name, flowData: { nodes: snapshot.nodes, edges: snapshot.edges } },
    }, {
      onSuccess: () => {
        savedBaselineRef.current = snapshot;
        setSavedBaseline(snapshot);
        acceptedServerSnapshotRef.current = snapshot;
        toast.success(t('editor.toasts.saved'));
      },
      onError: () => toast.error(t('editor.toasts.saveFailed')),
      onSettled: () => {
        saveInFlightRef.current = false;
        setSaveInFlight(false);
      },
    });
  }, [botId, currentSnapshot, updateBot, t]);

  const addNode = (type: string, label: string) => {
    const id = `node_${Date.now()}`;
    setNodes((prev) => [...prev, { id, type, label, config: {}, x: 220 + Math.random() * 200, y: 80 + prev.length * 90 }]);
    setSelectedNode(id);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedNode === id) setSelectedNode(null);
  };

  const deleteEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
  };

  // Pointer events preserve desktop drag behavior and allow touch editing.
  const handleCanvasMouseMove = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;

    if (connectFrom) {
      setMousePos({ x, y });
    }

    if (dragging) {
      didDragRef.current = true;
      setNodes((prev) => prev.map((n) =>
        n.id === dragging
          ? { ...n, x: Math.max(0, x - dragOffsetRef.current.x), y: Math.max(0, y - dragOffsetRef.current.y) }
          : n
      ));
    }
  }, [dragging, connectFrom]);

  const handleCanvasMouseUp = useCallback((e: React.PointerEvent) => {
    setDragging(null);

    // If connecting: check if we released on a valid target
    if (connectFrom) {
      const target = (e.target as HTMLElement).closest('[data-input-port]') as HTMLElement | null;
      const targetNode = (e.target as HTMLElement).closest('.flow-node') as HTMLElement | null;

      if (target) {
        // Released on an input handle
        const nodeId = target.getAttribute('data-node-id')!;
        const port = target.getAttribute('data-input-port')!;
        if (connectFrom.nodeId !== nodeId) {
          const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
          if (!exists) {
            setEdges((prev) => [...prev, {
              id: `edge_${Date.now()}`,
              source: connectFrom.nodeId,
              sourcePort: connectFrom.port,
              target: nodeId,
              targetPort: port,
            }]);
          }
        }
        setConnectFrom(null);
      } else if (targetNode) {
        // Released on a node body — connect to first input if available
        const nodeId = targetNode.getAttribute('data-node-id');
        if (nodeId && connectFrom.nodeId !== nodeId) {
          const targetMeta = getNodeMeta(nodes.find((n) => n.id === nodeId)?.type || '');
          if (targetMeta && targetMeta.handles.inputs.length > 0) {
            const targetPort = targetMeta.handles.inputs[0];
            const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
            if (!exists) {
              setEdges((prev) => [...prev, {
                id: `edge_${Date.now()}`,
                source: connectFrom.nodeId,
                sourcePort: connectFrom.port,
                target: nodeId,
                targetPort,
              }]);
            }
          }
        }
        setConnectFrom(null);
      } else {
        // Released on empty canvas — cancel
        setConnectFrom(null);
      }
    }
  }, [connectFrom, nodes, edges]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if we clicked directly on the canvas (not on a node)
    if ((e.target as HTMLElement).closest('.flow-node')) return;
    setSelectedNode(null);
    setConnectFrom(null); // Cancel active connection on empty canvas click
  }, []);

  const handleNodeMouseDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectFrom) return; // Don't start drag while connecting

    const canvas = (e.currentTarget as HTMLElement).closest('.flow-canvas')!;
    const rect = canvas.getBoundingClientRect();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const mx = e.clientX - rect.left + canvas.scrollLeft;
    const my = e.clientY - rect.top + canvas.scrollTop;

    dragOffsetRef.current = { x: mx - node.x, y: my - node.y };
    didDragRef.current = false;
    setDragging(nodeId);
  }, [nodes, connectFrom]);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    // If connecting, complete the connection to this node's input
    if (connectFrom) {
      const targetMeta = getNodeMeta(nodes.find((n) => n.id === nodeId)?.type || '');
      if (connectFrom.nodeId !== nodeId && targetMeta && targetMeta.handles.inputs.length > 0) {
        const targetPort = targetMeta.handles.inputs[0];
        // Don't allow duplicate edges
        const exists = edges.some((e) => e.source === connectFrom.nodeId && e.sourcePort === connectFrom.port && e.target === nodeId);
        if (!exists) {
          setEdges((prev) => [...prev, {
            id: `edge_${Date.now()}`,
            source: connectFrom.nodeId,
            sourcePort: connectFrom.port,
            target: nodeId,
            targetPort,
          }]);
        }
      }
      setConnectFrom(null);
      return;
    }

    // Select (only if not finishing a drag)
    if (!didDragRef.current) {
      setSelectedNode(nodeId);
    }
  }, [connectFrom, nodes, edges]);

  // --- Output handle press: start connection ---
  const handleOutputPointerDown = useCallback((e: React.PointerEvent, nodeId: string, port: string) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = (e.currentTarget as HTMLElement).closest('.flow-canvas')!;
    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left + canvas.scrollLeft,
      y: e.clientY - rect.top + canvas.scrollTop,
    });
    setConnectFrom({ nodeId, port });
  }, []);

  // --- Input handle click: complete connection ---
  const handleInputClick = useCallback((e: React.MouseEvent, nodeId: string, port: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (connectFrom && connectFrom.nodeId !== nodeId) {
      const exists = edges.some((ed) => ed.source === connectFrom.nodeId && ed.sourcePort === connectFrom.port && ed.target === nodeId);
      if (!exists) {
        setEdges((prev) => [...prev, {
          id: `edge_${Date.now()}`,
          source: connectFrom.nodeId,
          sourcePort: connectFrom.port,
          target: nodeId,
          targetPort: port,
        }]);
      }
      setConnectFrom(null);
    }
  }, [connectFrom, edges]);

  const selectedNodeData = useMemo(() => nodes.find((n) => n.id === selectedNode), [nodes, selectedNode]);
  const nodeTypeMeta = useMemo(() => getNodeMeta(selectedNodeData?.type || ''), [selectedNodeData]);
  const commandClash = selectedNodeData?.type === 'trigger_command'
    ? clashesForCommand(String(selectedNodeData.config.command || ''), {
        custom: (Array.isArray(customCommands) ? customCommands : []).map((command: any) => command.name),
        flows: [
          ...flowCommandNames,
          ...(selectedNodeData?.config.command ? [String(selectedNodeData.config.command)] : []),
        ],
        builtins: BUILTIN_CHAT_COMMANDS,
      })
    : null;
  const edgeRoutes = useMemo(() => edges.flatMap((edge) => {
    const srcNode = nodes.find((node) => node.id === edge.source);
    const tgtNode = nodes.find((node) => node.id === edge.target);
    if (!srcNode || !tgtNode) return [];
    const srcMeta = getNodeMeta(srcNode.type);
    const tgtMeta = getNodeMeta(tgtNode.type);
    if (!srcMeta || !tgtMeta) return [];
    const srcPortIndex = srcMeta.handles.outputs.indexOf(edge.sourcePort);
    const tgtPortIndex = tgtMeta.handles.inputs.indexOf(edge.targetPort);
    if (srcPortIndex < 0 || tgtPortIndex < 0) return [];
    const source = getOutputHandlePos(srcNode, srcPortIndex, srcMeta.handles.outputs.length);
    const target = getInputHandlePos(tgtNode, tgtPortIndex, tgtMeta.handles.inputs.length);
    const obstacles = nodes
      .filter((node) => node.id !== srcNode.id && node.id !== tgtNode.id)
      .map((node) => ({ x: node.x, y: node.y, width: NODE_W, height: NODE_H }));
    return [{ edge, source, target, route: buildOrthogonalRoute(source, target, obstacles) }];
  }), [edges, nodes]);
  const canvasExtent = useMemo(() => computeCanvasExtent({
    nodes,
    routeBounds: edgeRoutes.map(({ route }) => route.bounds),
    viewportWidth: canvasViewport.width,
    viewportHeight: canvasViewport.height,
  }), [canvasViewport, edgeRoutes, nodes]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[34rem] flex-col md:h-[calc(100dvh-8rem)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => requestNavigation('/bots')} aria-label={t('editor.toolbar.back')} title={t('editor.toolbar.back')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={botName} onChange={(e) => setBotName(e.target.value)} className="h-9 min-w-0 flex-1 text-sm font-medium sm:h-8 sm:w-60 sm:flex-none" aria-label={t('editor.toolbar.nameAria')} />
          <Badge variant={isDirty ? 'default' : 'outline'} className="hidden text-[10px] sm:inline-flex">{isDirty ? t('editor.toolbar.unsaved') : t('editor.toolbar.saved')}</Badge>
          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{t('editor.toolbar.nodes', { count: nodes.length })}</Badge>
          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{t('editor.toolbar.edges', { count: edges.length })}</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHelp(true)} aria-label={t('editor.toolbar.helpAria')} title={t('editor.toolbar.help')}>
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleSave} disabled={saveInFlight}>
            <Save className="h-4 w-4 mr-1" /> {t('common:action.save')}
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-lg border border-border md:flex-row">
        {/* Node Palette */}
        <div className="h-28 w-full shrink-0 border-b border-border bg-card/50 md:h-auto md:w-52 md:border-b-0 md:border-r">
          <ScrollArea className="h-full">
            <div className="flex w-max gap-4 p-2 md:block md:w-auto md:space-y-4 md:p-3">
              {NODE_CATEGORIES.map((cat) => (
                <div key={cat.labelKey}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">{t(cat.labelKey)}</p>
                  <div className="flex gap-1 md:block md:space-y-1">
                    {cat.nodes.map((node) => (
                      <button
                        key={node.type}
                        className={cn('flex min-h-10 w-36 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:opacity-80 md:min-h-0 md:w-full', node.color)}
                        onClick={() => addNode(node.type, t(node.labelKey))}
                      >
                        <node.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{t(node.labelKey)}</span>
                        <Plus className="h-3 w-3 ml-auto opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flow-canvas relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto bg-zinc-950/30"
          style={{
            cursor: connectFrom ? 'crosshair' : 'default',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          onPointerMove={handleCanvasMouseMove}
          onPointerUp={handleCanvasMouseUp}
          onClick={handleCanvasClick}
        >
          <div className="relative" style={{ width: canvasExtent.width, height: canvasExtent.height }}>
          <svg className="absolute inset-0 pointer-events-none" width={canvasExtent.width} height={canvasExtent.height} viewBox={`0 0 ${canvasExtent.width} ${canvasExtent.height}`}>
            {/* Edges */}
            {edgeRoutes.map(({ edge, source: src, target: tgt, route }) => {
              const isConditionTrue = edge.sourcePort === 'true';
              const isConditionFalse = edge.sourcePort === 'false';

              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer" aria-label={t('editor.edge.aria', { kind: isConditionTrue ? t('editor.edge.true') : isConditionFalse ? t('editor.edge.false') : t('editor.edge.flow') })} onClick={(ev) => { ev.stopPropagation(); deleteEdge(edge.id); }}>
                  <path
                    d={route.path}
                    fill="none"
                    stroke={isConditionTrue ? 'hsl(var(--success))' : isConditionFalse ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                  />
                  {/* Invisible wider path for easier click */}
                  <path
                    d={route.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                  />
                  {/* Arrow at target */}
                  <circle cx={tgt.x} cy={tgt.y} r={3}
                    fill={isConditionTrue ? 'hsl(var(--success))' : isConditionFalse ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    fillOpacity={0.8}
                  />
                  {(isConditionTrue || isConditionFalse) && (
                    <text x={src.x + 12} y={src.y - 8} className="text-[10px]" fill={isConditionTrue ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}>{isConditionTrue ? t('editor.edge.true') : t('editor.edge.false')}</text>
                  )}
                </g>
              );
            })}

            {/* Connection drag preview */}
            {connectFrom && (() => {
              const srcNode = nodes.find((n) => n.id === connectFrom.nodeId);
              const srcMeta = srcNode ? getNodeMeta(srcNode.type) : null;
              if (!srcNode || !srcMeta) return null;
              const idx = srcMeta.handles.outputs.indexOf(connectFrom.port);
              if (idx < 0) return null;
              const src = getOutputHandlePos(srcNode, idx, srcMeta.handles.outputs.length);
              const previewRoute = buildOrthogonalRoute(src, mousePos, []);
              return (
                <path
                  d={previewRoute.path}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.7}
                />
              );
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const meta = getNodeMeta(node.type);
            if (!meta) return null;
            const Icon = meta.icon;
            const hasInputs = meta.handles.inputs.length > 0;
            const outputs = meta.handles.outputs;

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className={cn(
                  'flow-node absolute touch-none select-none rounded-lg border bg-card/95 backdrop-blur-sm shadow-sm transition-shadow',
                  selectedNode === node.id ? 'border-primary ring-1 ring-primary/30 shadow-md' : 'border-border hover:border-muted-foreground/30',
                  dragging === node.id ? 'cursor-grabbing shadow-lg z-20' : 'cursor-grab z-10',
                )}
                style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                onPointerDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
              >
                {/* Header */}
                <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b border-border', meta.color)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium truncate">{node.label}</span>
                </div>
                {/* Body */}
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-muted-foreground truncate">{node.type.replace(/_/g, ' ')}</p>
                </div>

                {/* Input handle(s) - left side */}
                {hasInputs && meta.handles.inputs.map((port, i) => {
                  const pos = getInputHandlePos(node, i, meta.handles.inputs.length);
                  return (
                    <button
                      type="button"
                      key={`in-${port}`}
                      data-input-port={port}
                      data-node-id={node.id}
                      className={cn(
                        "absolute z-30 rounded-full border-2 border-card transition-colors after:absolute after:-inset-3 after:content-['']",
                        connectFrom ? 'bg-primary hover:bg-primary scale-125' : 'bg-muted-foreground/50 hover:bg-primary',
                      )}
                      style={{
                        left: -HANDLE_R,
                        top: (pos.y - node.y) - HANDLE_R,
                        width: HANDLE_R * 2,
                        height: HANDLE_R * 2,
                      }}
                      onClick={(e) => handleInputClick(e, node.id, port)}
                      title={t('editor.node.inputTitle', { port })}
                      aria-label={t('editor.node.inputAria', { label: node.label, port })}
                    />
                  );
                })}

                {/* Output handle(s) - right side */}
                {outputs.map((port, i) => {
                  const pos = getOutputHandlePos(node, i, outputs.length);
                  const isTrue = port === 'true';
                  const isFalse = port === 'false';
                  return (
                    <div
                      key={`out-${port}`}
                      className="absolute z-30 flex items-center gap-1"
                      style={{
                        left: NODE_W - HANDLE_R,
                        top: (pos.y - node.y) - HANDLE_R,
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "relative cursor-crosshair rounded-full border-2 border-card transition-colors after:absolute after:-inset-3 after:content-['']",
                          isTrue ? 'bg-green-500 hover:bg-green-400' :
                          isFalse ? 'bg-red-500 hover:bg-red-400' :
                          'bg-primary/60 hover:bg-primary',
                        )}
                        style={{ width: HANDLE_R * 2, height: HANDLE_R * 2 }}
                        onPointerDown={(e) => handleOutputPointerDown(e, node.id, port)}
                        title={t('editor.node.outputTitle', { port })}
                        aria-label={t('editor.node.outputAria', { label: node.label, port })}
                      />
                      {outputs.length > 1 && (
                        <span className={cn(
                          'text-[8px] font-mono-data ml-1 select-none pointer-events-none',
                          isTrue ? 'text-green-400' : isFalse ? 'text-red-400' : 'text-muted-foreground',
                        )}>
                          {port}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>

          {/* Connection hint */}
          {connectFrom && (
            <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 bg-primary/20 border border-primary/30 text-primary text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              {t('editor.connectHint')}
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {selectedNodeData && (
          <div className="absolute inset-x-0 bottom-0 z-40 max-h-[55%] w-full shrink-0 border-t border-border bg-card/95 shadow-2xl backdrop-blur-sm md:static md:max-h-none md:w-64 md:border-l md:border-t-0 md:bg-card/50 md:shadow-none">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{t('editor.properties.title')}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteNode(selectedNodeData.id)} aria-label={t('editor.properties.deleteAria', { label: selectedNodeData.label })} title={t('editor.properties.deleteAria', { label: selectedNodeData.label })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('editor.properties.label')}</Label>
                  <Input
                    className="h-7 text-xs mt-1"
                    value={selectedNodeData.label}
                    onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, label: e.target.value } : n))}
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">{t('editor.properties.type')}</Label>
                  <div className={cn('mt-1 text-xs px-2 py-1 rounded border', nodeTypeMeta?.color || 'bg-muted/30')}>
                    {selectedNodeData.type.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Ports info */}
                {nodeTypeMeta && (
                  <div className="flex gap-2 text-[10px]">
                    {nodeTypeMeta.handles.inputs.length > 0 && (
                      <Badge variant="secondary" className="text-[9px]">{t('editor.properties.in', { ports: nodeTypeMeta.handles.inputs.join(', ') })}</Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px]">{t('editor.properties.out', { ports: nodeTypeMeta.handles.outputs.join(', ') })}</Badge>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">{t('editor.properties.configuration')}</p>

                  {selectedNodeData.type === 'trigger_event' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.eventName')}</Label>
                      <Select
                        value={selectedNodeData.config.eventName || ''}
                        onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, eventName: v } } : n))}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder={t('editor.fields.selectEvent')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notifycliententerview">{t('editor.fields.events.clientEnter')}</SelectItem>
                          <SelectItem value="notifyclientleftview">{t('editor.fields.events.clientLeave')}</SelectItem>
                          <SelectItem value="notifytextmessage">{t('editor.fields.events.textMessage')}</SelectItem>
                          <SelectItem value="notifyclientmoved">{t('editor.fields.events.clientMoved')}</SelectItem>
                          <SelectItem value="notifyserveredited">{t('editor.fields.events.serverEdited')}</SelectItem>
                          <SelectItem value="notifychanneldescriptionchanged">{t('editor.fields.events.channelDescChanged')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedNodeData.type === 'trigger_cron' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.cronExpression')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="*/5 * * * *"
                          value={selectedNodeData.config.cron || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, cron: e.target.value } } : n))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.timezone')}</Label>
                        <Select
                          value={selectedNodeData.config.timezone || 'UTC'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, timezone: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                            <SelectItem value="Europe/London">Europe/London</SelectItem>
                            <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                            <SelectItem value="Europe/Moscow">Europe/Moscow</SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                            <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                            <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                            <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'trigger_webhook' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.webhookPath')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="my-hook"
                          value={selectedNodeData.config.path || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, path: e.target.value } } : n))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.httpMethod')}</Label>
                        <Select
                          value={selectedNodeData.config.method || 'POST'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="GET">GET</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.secretOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('editor.fields.secretPlaceholder')}
                          type="password"
                          value={selectedNodeData.config.secret || ''}
                          onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, secret: e.target.value } } : n))}
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{t('editor.fields.secretHint')}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'trigger_command' && (
                  <div className="space-y-2">
                      <div>
                        <Label htmlFor="flow-trigger-command" className="text-[10px] text-muted-foreground">{t('editor.fields.command')}</Label>
                        <Input
                          id="flow-trigger-command"
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="!help"
                          value={selectedNodeData.config.command || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, command: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        {commandClash && (
                          <p role="alert" className="mt-1 text-[10px] text-amber-500">
                            {t('editor.fields.commandClash', { detail: describeCommandClash(commandClash) })}
                          </p>
                        )}
                        {selectedNodeData.config.cooldownSeconds > 0 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">{t('editor.fields.cooldown', { seconds: selectedNodeData.config.cooldownSeconds })}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.listenChannelId')}</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="42"
                          value={selectedNodeData.config.channelId || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channelId: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('editor.fields.listenChannelHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_message' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.targetMode')}</Label>
                        <Select
                          value={selectedNodeData.config.targetMode || 'client'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, targetMode: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">{t('editor.fields.client')}</SelectItem>
                            <SelectItem value="channel">{t('editor.fields.channel')}</SelectItem>
                            <SelectItem value="server">{t('editor.fields.server')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedNodeData.config.targetMode !== 'server' && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            {selectedNodeData.config.targetMode === 'channel' ? t('editor.fields.channelId') : t('editor.fields.clientId')}
                          </Label>
                          <Input
                            className="h-7 text-xs mt-1 font-mono-data"
                            placeholder={selectedNodeData.config.targetMode === 'channel'
                              ? t('editor.fields.channelTargetPlaceholder', { token: '{{event.ctid}}' })
                              : t('editor.fields.clientTargetPlaceholder', { token: '{{event.clid}}' })}
                            value={selectedNodeData.config.target || ''}
                            onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, target: e.target.value } } : n))}
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.message')}</Label>
                        <Textarea
                          className="min-h-[120px] text-xs mt-1 resize-y font-mono-data"
                          placeholder={t('editor.fields.messagePlaceholder')}
                          value={selectedNodeData.config.message || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, message: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('editor.fields.messageHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_kick' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.kickFrom')}</Label>
                        <Select
                          value={selectedNodeData.config.reasonid || '5'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reasonid: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">{t('editor.fields.channel')}</SelectItem>
                            <SelectItem value="5">{t('editor.fields.server')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.reason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.kickReasonPlaceholder')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_ban' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.duration')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="3600" value={selectedNodeData.config.time || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, time: parseInt(e.target.value) || 0 } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.reason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.banReasonPlaceholder')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_move' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.targetChannelId')}</Label>
                      <Input
                        className="h-7 text-xs mt-1 font-mono-data"
                        placeholder={t('editor.fields.targetChannelPlaceholder', { token: '{{temp.lastCreatedChannelId}}' })}
                        value={selectedNodeData.config.cid ?? ''}
                        onChange={(e) =>
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode
                                ? { ...n, config: { ...n.config, cid: e.target.value } }
                                : n
                            )
                          )
                        }
                      />
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {t('editor.fields.targetChannelExample', { token: '{{temp.lastCreatedChannelId}}' })}
                      </p>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_poke' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.message')}</Label>
                      <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.pokePlaceholder', { token: '{{event.client_nickname}}' })} value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelCreate' && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!!selectedNodeData.config.trackTempChannel}
                          disabled={selectedNodeData.config.channel_flag_semi_permanent !== '1' || !selectedNodeData.config.cpid || selectedNodeData.config.cpid === '0'}
                          onChange={(e) => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, config: { ...n.config, trackTempChannel: e.target.checked } } : n))}
                        />
                        {t('editor.fields.trackTempChannel')}
                      </label>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelName')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="[cspacer]Info" value={selectedNodeData.config.channel_name || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_name: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.parentChannelId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="0" value={selectedNodeData.config.cpid || ''} onChange={(e) => setNodes((prev) => prev.map((n) => {
                          if (n.id !== selectedNode) return n;
                          const cfg: any = { ...n.config, cpid: e.target.value };
                          if (!e.target.value || e.target.value === '0') cfg.trackTempChannel = false;
                          return { ...n, config: cfg };
                        }))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelPasswordOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('editor.fields.channelPasswordPlaceholder', { token: '{{temp.channelPassword}}' })}
                          value={selectedNodeData.config.channel_password || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channel_password: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelLifetime')}</Label>
                        <Select value={selectedNodeData.config.channel_flag_temporary || '0'} onValueChange={(v) => setNodes((prev) => prev.map((n) => { if (n.id !== selectedNode) return n; const cfg: any = { ...n.config }; if (v === '1') { cfg.channel_flag_temporary = '1'; delete cfg.channel_flag_semi_permanent; cfg.trackTempChannel = false; } else { cfg.channel_flag_temporary = '0'; cfg.channel_flag_semi_permanent = '1'; } return { ...n, config: cfg }; }) ) }>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t('editor.fields.semiPermanent')}</SelectItem>
                            <SelectItem value="1">{t('editor.fields.temporary')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelEdit' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelName')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder="[cspacer]{{time.time}}" value={selectedNodeData.config.channel_name || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_name: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelTopic')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.optional')} value={selectedNodeData.config.channel_topic || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_topic: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelDescription')}</Label>
                        <Textarea className="text-xs mt-1 min-h-[60px] font-mono-data" placeholder="{{temp.apiResult}}" value={selectedNodeData.config.channel_description || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channel_description: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelPasswordOptional')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder={t('editor.fields.channelPasswordPlaceholder', { token: '{{temp.channelPassword}}' })}
                          value={selectedNodeData.config.channel_password || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, channel_password: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('editor.fields.leaveEmptyKeep')}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_channelDelete' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.forceDelete')}</Label>
                        <Select value={selectedNodeData.config.force ? '1' : '0'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, force: v === '1' } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t('editor.fields.no')}</SelectItem>
                            <SelectItem value="1">{t('editor.fields.yesDeleteSubChannels')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {(selectedNodeData.type === 'action_groupAdd' || selectedNodeData.type === 'action_groupRemove') && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.serverGroupId')}</Label>
                      <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="6" value={selectedNodeData.config.groupId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, groupId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_webquery' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.command')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="serverinfo" value={selectedNodeData.config.command || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, command: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="server" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.webQueryAccessHint', { token: '{{temp.server.virtualserver_name}}' })}</p>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_webhook' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.url')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="https://example.com/hook" value={selectedNodeData.config.url || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, url: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.method')}</Label>
                        <Select value={selectedNodeData.config.method || 'POST'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.bodyJson')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='{"key":"value"}' value={selectedNodeData.config.body || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, body: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="response" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_httpRequest' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.url')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="https://api.example.com/check" value={selectedNodeData.config.url || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, url: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.method')}</Label>
                        <Select value={selectedNodeData.config.method || 'GET'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, method: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.headersJson')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder='{"Authorization":"Bearer xxx"}'
                          value={selectedNodeData.config.headersRaw ?? (selectedNodeData.config.headers ? JSON.stringify(selectedNodeData.config.headers) : '')}
                          onChange={(e) => {
                            const raw = e.target.value;
                            let parsed: Record<string, string> | undefined;
                            try { parsed = JSON.parse(raw); } catch { /* user still typing */ }
                            setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, headersRaw: raw, headers: parsed ?? n.config.headers } } : n));
                          }}
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{t('editor.fields.headersHint', { token: '{{placeholders}}' })}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.bodyJson')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='{"ip":"{{event.connection_client_ip}}"}' value={selectedNodeData.config.body || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, body: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.storeAsTemp')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="apiResult" value={selectedNodeData.config.storeAs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, storeAs: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_afkMover' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.afkChannelId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="10" value={selectedNodeData.config.afkChannelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, afkChannelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.idleThreshold')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="300" value={selectedNodeData.config.idleThresholdSeconds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, idleThresholdSeconds: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.exemptGroupIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="6,7" value={selectedNodeData.config.exemptGroupIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, exemptGroupIds: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.exemptChannelIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="12,15" value={selectedNodeData.config.exemptChannelIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, exemptChannelIds: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_idleKicker' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.idleThreshold')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="1800" value={selectedNodeData.config.idleThresholdSeconds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, idleThresholdSeconds: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.kickReason')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.idleTimeoutPlaceholder')} value={selectedNodeData.config.reason || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, reason: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.exemptGroupIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="6,7" value={selectedNodeData.config.exemptGroupIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, exemptGroupIds: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_pokeGroup' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.serverGroupId')}</Label>
                        <Input type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="6" value={selectedNodeData.config.groupId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, groupId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.message')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.pokeGroupPlaceholder')} value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_rankCheck' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.ranksJson')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder='[{"hours":10,"groupId":"7"},{"hours":50,"groupId":"8"}]' value={selectedNodeData.config.ranks || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, ranks: e.target.value } } : n))} />
                      <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.ranksHint', { shape: '{hours, groupId}' })}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_tempChannelCleanup' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.parentChannelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="19" value={selectedNodeData.config.parentChannelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, parentChannelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.protectedChannelIds')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="20,21" value={selectedNodeData.config.protectedChannelIds || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, protectedChannelIds: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.protectedChannelIdsHint')}</p>
                      </div>
                    </>
                  )}

                  {selectedNodeData.type === 'action_animatedChannel' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="42" value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.displayText')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.displayTextPlaceholder')} value={selectedNodeData.config.text || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, text: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.displayTextHint', { time: '{{time.time}}', date: '{{time.date}}' })}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.animationStyle')}</Label>
                        <Select value={selectedNodeData.config.style || 'scroll'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, style: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scroll">{t('editor.fields.animations.scroll')}</SelectItem>
                            <SelectItem value="typewriter">{t('editor.fields.animations.typewriter')}</SelectItem>
                            <SelectItem value="bounce">{t('editor.fields.animations.bounce')}</SelectItem>
                            <SelectItem value="blink">{t('editor.fields.animations.blink')}</SelectItem>
                            <SelectItem value="wave">{t('editor.fields.animations.wave')}</SelectItem>
                            <SelectItem value="alternateCase">{t('editor.fields.animations.alternateCase')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.speed')}</Label>
                        <Select
                          value={(() => {
                            const raw = selectedNodeData.config.intervalSeconds || '10';
                            const n = parseFloat(String(raw));
                            if (!Number.isFinite(n) || n < 10) return '10';
                            if (n <= 10) return '10';
                            if (n <= 15) return '15';
                            if (n <= 30) return '30';
                            return '60';
                          })()}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, intervalSeconds: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">{t('editor.fields.speeds.normal')}</SelectItem>
                            <SelectItem value="15">{t('editor.fields.speeds.relaxed')}</SelectItem>
                            <SelectItem value="30">{t('editor.fields.speeds.calm')}</SelectItem>
                            <SelectItem value="60">{t('editor.fields.speeds.slow')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.speedHint')}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.prefix')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="[cspacer]" value={selectedNodeData.config.prefix ?? '[cspacer]'} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, prefix: e.target.value } } : n))} />
                        <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.prefixHint', { prefix: '[cspacer]' })}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.suppressEditEvents')}</Label>
                        <Select
                          value={selectedNodeData.config.suppressEditEvents === false || selectedNodeData.config.suppressEditEvents === 'false' ? 'false' : 'true'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, suppressEditEvents: v === 'true' } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">{t('editor.fields.yesRecommended')}</SelectItem>
                            <SelectItem value="false">{t('editor.fields.no')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[9px] text-muted-foreground mt-1">
                          {t('editor.fields.suppressEditEventsHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Voice Action Configs */}
                  {selectedNodeData.type === 'action_voicePlay' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.botIdPlaceholder', { token: '{{var.botId}}' })} value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.songId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.songIdPlaceholder')} value={selectedNodeData.config.songId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, songId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.playlistId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.playlistIdPlaceholder')} value={selectedNodeData.config.playlistId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, playlistId: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceStop' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.botIdPlaceholder', { token: '{{var.botId}}' })} value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceJoinChannel' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.channelTargetPlaceholder', { token: '{{event.ctid}}' })} value={selectedNodeData.config.channelId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.channelPasswordOptional')}</Label>
                        <Input className="h-7 text-xs mt-1" type="password" placeholder={t('editor.fields.optional')} value={selectedNodeData.config.channelPassword || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, channelPassword: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceLeaveChannel' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                      <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceVolume' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.volume')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder={t('editor.fields.volumePlaceholder', { token: '{{event.volume}}' })} value={selectedNodeData.config.volume || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, volume: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voicePauseResume' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.action')}</Label>
                        <Select value={selectedNodeData.config.action || 'toggle'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, action: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pause">{t('editor.fields.pause')}</SelectItem>
                            <SelectItem value="resume">{t('editor.fields.resume')}</SelectItem>
                            <SelectItem value="toggle">{t('editor.fields.toggle')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceSkip' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.direction')}</Label>
                        <Select value={selectedNodeData.config.direction || 'next'} onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, direction: v } } : n))}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="next">{t('editor.fields.next')}</SelectItem>
                            <SelectItem value="previous">{t('editor.fields.previous')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceSeek' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.position')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="30" value={selectedNodeData.config.position || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, position: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_voiceTts' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.botId')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="1" value={selectedNodeData.config.botId || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, botId: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.text')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.ttsPlaceholder', { token: '{{event.client_nickname}}' })} value={selectedNodeData.config.text || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, text: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.languageOptional')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="en" value={selectedNodeData.config.language || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, language: e.target.value } } : n))} />
                      </div>
                      <p className="text-[9px] text-muted-foreground/60">{t('editor.fields.ttsHint')}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'condition' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('editor.fields.expression')}</Label>
                      <Input
                        className="h-7 text-xs mt-1 font-mono-data"
                        placeholder='event.client_type == 0'
                        value={selectedNodeData.config.expression || ''}
                        onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, expression: e.target.value } } : n))}
                      />
                      <p className="text-[9px] text-muted-foreground mt-1">{t('editor.fields.conditionHint')}</p>
                    </div>
                  )}

                  {selectedNodeData.type === 'delay' && (
                    <div>
                      {selectedNodeData.config.delayFromCommand ? (
                        <p className="text-xs text-muted-foreground">{t('editor.fields.delayFromCommandHint')}</p>
                      ) : (
                        <>
                          <Label htmlFor="delay-ms" className="text-[10px] text-muted-foreground">{t('editor.fields.delayMs')}</Label>
                          <Input id="delay-ms" type="number" className="h-7 text-xs mt-1 font-mono-data" placeholder="5000" value={selectedNodeData.config.delayMs || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, delayMs: Number.parseInt(e.target.value) || 0 } } : n))} />
                        </>
                      )}
                    </div>
                  )}

                  {selectedNodeData.type === 'variable' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.variableName')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="myVar" value={selectedNodeData.config.varName || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, varName: e.target.value } } : n))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.valueExpression')}</Label>
                        <Input className="h-7 text-xs mt-1 font-mono-data" placeholder="event.clid" value={selectedNodeData.config.varValue || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, varValue: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}

                  {selectedNodeData.type === 'action_generateCode' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.length')}</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="5"
                          value={selectedNodeData.config.length ?? '5'}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, length: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.storeAs')}</Label>
                        <Input
                          className="h-7 text-xs mt-1 font-mono-data"
                          placeholder="code"
                          value={selectedNodeData.config.storeAs ?? 'code'}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, storeAs: e.target.value } }
                                  : n
                              )
                            )
                          }
                        />
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          {t('editor.fields.storeAsUseAs', { token: `{{temp.${selectedNodeData.config.storeAs ?? 'code'}}}` })}
                        </p>
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.characters')}</Label>
                        <Select
                          value={(selectedNodeData.config.numericOnly ?? true) ? 'digits' : 'alnum'}
                          onValueChange={(v) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode
                                  ? { ...n, config: { ...n.config, numericOnly: v === 'digits' } }
                                  : n
                              )
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="digits">{t('editor.fields.digitsOnly')}</SelectItem>
                            <SelectItem value="alnum">{t('editor.fields.alphanumeric')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {selectedNodeData.type === 'log' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.logLevel')}</Label>
                        <Select
                          value={selectedNodeData.config.level || 'info'}
                          onValueChange={(v) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, level: v } } : n))}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debug">{t('editor.fields.logLevels.debug')}</SelectItem>
                            <SelectItem value="info">{t('editor.fields.logLevels.info')}</SelectItem>
                            <SelectItem value="warn">{t('editor.fields.logLevels.warning')}</SelectItem>
                            <SelectItem value="error">{t('editor.fields.logLevels.error')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('editor.fields.message')}</Label>
                        <Input className="h-7 text-xs mt-1" placeholder={t('editor.fields.logPlaceholder', { token: '{{event.client_nickname}}' })} value={selectedNodeData.config.message || ''} onChange={(e) => setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, config: { ...n.config, message: e.target.value } } : n))} />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Connections overview */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">{t('editor.connections.title')}</p>
                  <div className="space-y-1">
                    {edges.filter((e) => e.source === selectedNodeData.id).map((edge) => {
                      const target = nodes.find((n) => n.id === edge.target);
                      return (
                        <div key={edge.id} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">{edge.sourcePort}</span>
                            <span>→</span>
                            <span>{target?.label || '?'}</span>
                          </span>
                          <button onClick={() => deleteEdge(edge.id)} className="text-destructive hover:text-destructive" aria-label={t('editor.connections.removeAria', { target: target?.label || '?' })}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    {edges.filter((e) => e.target === selectedNodeData.id).map((edge) => {
                      const source = nodes.find((n) => n.id === edge.source);
                      return (
                        <div key={edge.id} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                          <span className="flex items-center gap-1">
                            <span>{source?.label || '?'}</span>
                            <span>→</span>
                            <span className="text-muted-foreground">{edge.targetPort}</span>
                          </span>
                          <button onClick={() => deleteEdge(edge.id)} className="text-destructive hover:text-destructive" aria-label={t('editor.connections.removeAria', { target: source?.label || '?' })}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    {edges.filter((e) => e.source === selectedNodeData.id || e.target === selectedNodeData.id).length === 0 && (
                      <p className="text-[10px] text-muted-foreground/50">{t('editor.connections.empty')}</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title={t('editor.discard.title')}
        description={t('editor.discard.description')}
        cancelLabel={t('editor.discard.stay')}
        confirmLabel={t('editor.discard.confirm')}
        destructive
        onConfirm={() => {
          const destination = pendingNavigation;
          setShowDiscardDialog(false);
          setPendingNavigation(null);
          if (destination) navigate(destination);
        }}
      />

      <PlaceholderReference open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
