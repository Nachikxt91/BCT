"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COOKIE = "tradedoc_sidebar";
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3.25rem";

const SidebarContext = React.createContext(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ defaultOpen = true, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(SIDEBAR_COOKIE);
      if (stored === "0") setOpen(false);
      if (stored === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setOpenPersist = React.useCallback((value) => {
    setOpen((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        localStorage.setItem(SIDEBAR_COOKIE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setOpenPersist((v) => !v);
  }, [setOpenPersist]);

  const state = open ? "expanded" : "collapsed";

  const value = React.useMemo(
    () => ({
      state,
      open,
      setOpen: setOpenPersist,
      toggleSidebar,
      mobileOpen,
      setMobileOpen,
      mounted,
    }),
    [state, open, setOpenPersist, toggleSidebar, mobileOpen, mounted]
  );

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
        <div
          className="group/sidebar-wrapper flex min-h-svh w-full"
          style={{
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          }}
          data-state={state}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children, ...props }) {
  const { state, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Mobile overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "group fixed inset-y-0 left-0 z-50 flex h-svh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-linear md:sticky md:top-0 md:z-20",
          "w-[var(--sidebar-width)]",
          state === "collapsed" && "md:w-[var(--sidebar-width-icon)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          className
        )}
        data-state={state}
        data-collapsible={state === "collapsed" ? "icon" : ""}
        {...props}
      >
        {children}
      </aside>
    </>
  );
}

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }) {
  return <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]/overflow-hidden", className)}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }) {
  return <div className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }) {
  const { state } = useSidebar();
  return (
    <div
      className={cn(
        "flex h-8 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-opacity",
        state === "collapsed" && "md:opacity-0 md:h-0 md:overflow-hidden md:p-0",
        className
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }) {
  return <li className={cn("group/menu-item relative", className)} {...props} />;
}

export function SidebarMenuButton({
  className,
  asChild = false,
  isActive = false,
  tooltip,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  const { state } = useSidebar();
  const button = (
    <Comp
      data-active={isActive}
      className={cn(
        "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground [&>span]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        state === "collapsed" && "md:size-9 md:justify-center md:p-2 md:[&>span]:hidden",
        className
      )}
      {...props}
    />
  );

  if (!tooltip || state === "expanded") return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarSeparator({ className, ...props }) {
  return <Separator className={cn("mx-2 w-auto bg-sidebar-border", className)} {...props} />;
}

export function SidebarTrigger({ className, ...props }) {
  const { toggleSidebar, setMobileOpen, mobileOpen } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
          setMobileOpen(!mobileOpen);
        } else {
          toggleSidebar();
        }
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}

export function SidebarInset({ className, ...props }) {
  return (
    <main
      className={cn("relative flex min-h-svh min-w-0 flex-1 flex-col bg-background", className)}
      {...props}
    />
  );
}
