import { useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronRight,
  Code,
  Code2,
  EyeOff,
  FunctionSquare,
  Heading,
  Highlighter,
  Italic,
  Link,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Network,
  Pilcrow,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  insertAtCursor,
  insertBlock,
  prefixLines,
  wrapSelection,
  type TextSelection,
} from '@/lib/ts6-format-insert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Ts6ChatResponseEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
}

function ToolbarIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function ToolbarMenuTrigger({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-0.5 px-1.5 text-muted-foreground hover:text-foreground"
        title={label}
        aria-label={label}
      >
        {children}
        <ChevronRight className="h-3 w-3 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
  );
}

export function Ts6ChatResponseEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  className,
  id,
}: Ts6ChatResponseEditorProps) {
  const { t } = useTranslation('bots');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getSelection = (): TextSelection => {
    const el = textareaRef.current;
    if (!el) return { start: value.length, end: value.length };
    return { start: el.selectionStart, end: el.selectionEnd };
  };

  const applyEdit = useCallback(
    (fn: (value: string, sel: TextSelection) => { value: string; selection: TextSelection }) => {
      const el = textareaRef.current;
      const sel = getSelection();
      const result = fn(value, sel);
      onChange(result.value);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(result.selection.start, result.selection.end);
      });
    },
    [value, onChange],
  );

  const wrap = (before: string, after: string, placeholder?: string) =>
    applyEdit((v, s) => wrapSelection(v, s, before, after, placeholder));

  const prefix = (pfx: string, placeholder?: string) =>
    applyEdit((v, s) => prefixLines(v, s, pfx, placeholder));

  const insert = (text: string, selectInserted?: boolean) =>
    applyEdit((v, s) => insertAtCursor(v, s, text, selectInserted));

  const block = (text: string) => applyEdit((v, s) => insertBlock(v, s, text));

  return (
    <div
      className={cn(
        'rounded-md border border-border/80 bg-background shadow-sm ring-1 ring-primary/10 focus-within:ring-primary/30 transition-shadow',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1">
        <ToolbarIconButton label={t('chatEditor.bold')} onClick={() => wrap('**', '**', 'bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label={t('chatEditor.italic')} onClick={() => wrap('*', '*', 'italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label={t('chatEditor.strikethrough')} onClick={() => wrap('~~', '~~', 'strike')}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label={t('chatEditor.underline')} onClick={() => wrap('<u>', '</u>', 'underline')}>
          <Underline className="h-3.5 w-3.5" />
        </ToolbarIconButton>

        <div className="mx-0.5 h-4 w-px bg-border/80" />

        <ToolbarIconButton
          label={t('chatEditor.link')}
          onClick={() => wrap('[', '](https://example.com)', 'link text')}
        >
          <Link className="h-3.5 w-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label={t('chatEditor.blockquote')} onClick={() => prefix('> ', 'quote')}>
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarIconButton>
        <ToolbarIconButton label={t('chatEditor.inlineCode')} onClick={() => wrap('`', '`', 'code')}>
          <Code className="h-3.5 w-3.5" />
        </ToolbarIconButton>

        <DropdownMenu>
          <ToolbarMenuTrigger label={t('chatEditor.lists')}>
            <List className="h-3.5 w-3.5" />
          </ToolbarMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[10rem]">
            <DropdownMenuItem onClick={() => prefix('- ', 'item')}>
              <List className="h-4 w-4" />
              {t('chatEditor.bulletedList')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => prefix('1. ', 'item')}>
              <ListOrdered className="h-4 w-4" />
              {t('chatEditor.numberedList')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => prefix('- [ ] ', 'task')}>
              <ListTodo className="h-4 w-4" />
              {t('chatEditor.checklist')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <ToolbarMenuTrigger label={t('chatEditor.spoiler')}>
            <EyeOff className="h-3.5 w-3.5" />
          </ToolbarMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[11rem]">
            <DropdownMenuItem onClick={() => wrap('||', '||', 'spoiler')}>
              {t('chatEditor.inlineSpoiler')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => wrap('[spoiler]', '[/spoiler]', 'hidden text')}
            >
              {t('chatEditor.bbcodeSpoiler')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                block('<details>\n<summary>Spoiler title</summary>\n\nHidden content\n</details>')
              }
            >
              {t('chatEditor.detailsSummary')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <ToolbarMenuTrigger label={t('chatEditor.headings')}>
            <Heading className="h-3.5 w-3.5" />
          </ToolbarMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[10rem]">
            <DropdownMenuItem onClick={() => prefix('# ', 'Heading 1')}>
              {t('chatEditor.heading1')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => prefix('## ', 'Heading 2')}>
              {t('chatEditor.heading2')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => prefix('### ', 'Heading 3')}>
              {t('chatEditor.heading3')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => block('Setext title\n==============')}
            >
              {t('chatEditor.setextH1')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => block('Setext title\n--------------')}>
              {t('chatEditor.setextH2')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <ToolbarMenuTrigger label={t('chatEditor.others')}>
            <span className="text-[11px] font-medium">{t('chatEditor.others')}</span>
          </ToolbarMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuItem
              onClick={() => block('```\ncode block\n```')}
            >
              <Code2 className="h-4 w-4" />
              {t('chatEditor.codeBlock')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insert('[^1]', true)}>
              <Superscript className="h-4 w-4" />
              {t('chatEditor.footnoteRef')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => block('[^1]: Footnote text')}>
              <Subscript className="h-4 w-4" />
              {t('chatEditor.footnoteDefinition')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chatEditor.links')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => insert('https://example.com', true)}>
              <Link2 className="h-4 w-4" />
              {t('chatEditor.autolinkUrl')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => wrap('[', '][ref]', 'link text')}
            >
              {t('chatEditor.referenceLink')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => block('[ref]: https://example.com')}>
              {t('chatEditor.referenceDefinition')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chatEditor.math')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => wrap('$', '$', 'x^2')}>
              <FunctionSquare className="h-4 w-4" />
              {t('chatEditor.inlineMath')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => block('$$\nx = \\frac{-b}{2a}\n$$')}>
              {t('chatEditor.blockMath')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chatEditor.align')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => wrap('[left]', '[/left]', 'text')}>
              <AlignLeft className="h-4 w-4" />
              {t('chatEditor.left')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('[center]', '[/center]', 'text')}>
              <AlignCenter className="h-4 w-4" />
              {t('chatEditor.center')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('[right]', '[/right]', 'text')}>
              <AlignRight className="h-4 w-4" />
              {t('chatEditor.right')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('[justify]', '[/justify]', 'text')}>
              <AlignJustify className="h-4 w-4" />
              {t('chatEditor.justify')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                block('```mermaid\nflowchart LR\n  A --> B\n```')
              }
            >
              <Network className="h-4 w-4" />
              {t('chatEditor.mermaidDiagram')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('==', '==', 'highlight')}>
              <Highlighter className="h-4 w-4" />
              {t('chatEditor.highlight')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                block('| Col 1 | Col 2 |\n| --- | --- |\n| A | B |')
              }
            >
              <Table className="h-4 w-4" />
              {t('chatEditor.table')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insert('\n---\n')}>
              <Minus className="h-4 w-4" />
              {t('chatEditor.thematicBreak')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('![alt](', ')', 'https://example.com/image.png')}>
              {t('chatEditor.image')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => wrap('[b]', '[/b]', 'bold')}>
              {t('chatEditor.bbcodeBold')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => wrap('[color=#ff6600]', '[/color]', 'colored')}
            >
              {t('chatEditor.bbcodeColor')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex min-h-[120px] w-full resize-y rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
      />
    </div>
  );
}
