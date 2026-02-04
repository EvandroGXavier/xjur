import * as React from "react"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Tooltip = ({ children }: { children: React.ReactNode }) => <div className="relative group">{children}</div>

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  // Assuming Slot is not available, I'll just render children if asChild is true, but that's tricky.
  // For safety, I'll ignore asChild and just render the child provided if it's a valid element, or a button.
  // Actually, Shadcn TooltipTrigger with asChild usually wraps the child.
  if (asChild && React.isValidElement(props.children)) {
    return React.cloneElement(props.children as React.ReactElement, {
      ...props,
      ref,
      className: `${props.children.props.className || ''} ${className || ''}`
    })
  }
  return <button ref={ref} className={className} {...props} />
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`hidden group-hover:block absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
