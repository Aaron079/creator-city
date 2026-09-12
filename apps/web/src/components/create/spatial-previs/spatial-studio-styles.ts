const fields = '[&_label]:grid [&_label]:gap-1 [&_label]:min-w-0 [&_label]:text-[11px] [&_label]:text-[#b6c0c8] [&_input:not([type=checkbox]):not([type=range])]:w-full [&_input:not([type=checkbox]):not([type=range])]:min-w-0 [&_input:not([type=checkbox]):not([type=range])]:rounded [&_input:not([type=checkbox]):not([type=range])]:border [&_input:not([type=checkbox]):not([type=range])]:border-[#566069] [&_input:not([type=checkbox]):not([type=range])]:bg-[#101316] [&_input:not([type=checkbox]):not([type=range])]:p-1 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded [&_select]:border [&_select]:border-[#566069] [&_select]:bg-[#101316] [&_select]:p-1 [&_input[type=range]]:w-full [&_input[type=range]]:accent-[#72cdb9]'
const buttons = '[&_button]:inline-flex [&_button]:items-center [&_button]:gap-1 [&_button]:rounded [&_button]:border [&_button]:border-white/15 [&_button]:bg-[#21262c] [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs [&_button]:font-normal [&_button:hover]:bg-[#354149] [&_button:disabled]:opacity-40 [&_button:disabled]:cursor-not-allowed [&_button[aria-expanded=true]]:border-[#64b7a8] [&_button[aria-expanded=true]]:text-[#b6f4eb] [&_button[aria-pressed=true]]:border-[#64b7a8]'
const styles = {
  tools: `relative z-10 text-xs tracking-normal text-[#dce2e7] ${fields} ${buttons}`,
  bar: 'flex items-center gap-1.5 border-b border-white/10 bg-[#15191d] px-3 py-1.5 [&_button]:h-[30px] [&_button]:w-[30px] [&_button]:justify-center [&_span]:ml-2',
  inspector: 'absolute top-11 left-2 grid w-[282px] max-w-[calc(100vw-64px)] max-h-[340px] gap-2.5 overflow-y-auto rounded-md border border-[#596269] bg-[#171b20]/95 p-3 shadow-xl backdrop-blur-lg',
  vector: 'grid grid-cols-3 gap-1.5',
  actions: 'flex flex-wrap items-center gap-1.5',
  check: '!flex items-center gap-2',
  cutline: 'grid gap-1 border-t border-white/15 pt-2',
  comparison: `grid gap-2.5 border-t border-white/15 bg-[#14181c] p-3 text-xs text-[#e4e7eb] ${fields} ${buttons}`,
  screens: 'grid grid-cols-1 min-[600px]:grid-cols-2 gap-2',
  screen: 'relative aspect-video min-w-0 overflow-hidden bg-[#080b0d] [&_video]:h-full [&_video]:w-full [&_video]:object-contain [&>span]:pointer-events-none [&>span]:absolute [&>span]:top-1.5 [&>span]:left-2 [&>span]:z-10 [&>span]:bg-black/50 [&>span]:px-1',
  notes: 'grid gap-1.5',
  note: 'flex items-center gap-2 border-b border-white/10 py-1.5 [&_span]:flex-1 [&_span]:break-words',
  monitors: 'flex gap-2 overflow-x-auto bg-[#121619] p-2',
  monitor: 'relative aspect-video w-[190px] flex-none cursor-pointer border border-[#7d877d] [&_span]:absolute [&_span]:bottom-0 [&_span]:left-0 [&_span]:bg-black/60 [&_span]:px-1.5 [&_span]:py-0.5 [&_span]:text-[11px]',
}
export default styles
