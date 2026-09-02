"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, ShieldCheck, Settings } from "lucide-react";
import { logout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const nav = [
  { href: "/", label: "Cases", icon: LayoutDashboard },
  { href: "/upload", label: "Upload pack", icon: FileText },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BrandBlock() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
        TD
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-primary">
            TradeDoc OCR
          </p>
          <p className="truncate text-sm font-semibold leading-tight">Operations</p>
        </div>
      )}
    </div>
  );
}

function HeaderActions() {
  const { state } = useSidebar();
  if (state === "collapsed") return null;
  return <ThemeToggle className="h-8 w-8" />;
}

function CollapsedTheme() {
  const { state } = useSidebar();
  if (state !== "collapsed") return null;
  return (
    <div className="flex justify-center">
      <ThemeToggle className="h-8 w-8" />
    </div>
  );
}

function PipelineHint() {
  const { state } = useSidebar();
  if (state === "collapsed") return null;
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-xs text-muted-foreground">
      <p className="font-medium text-sidebar-foreground">Pipeline</p>
      <p className="mt-1">OCR → Extract → Review → Attest</p>
    </div>
  );
}

function UserBlock({ user, onLogout }) {
  const { state } = useSidebar();
  const membership = user?.memberships?.[0];
  if (!user) return null;

  if (state === "collapsed") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Sign out" onClick={onLogout}>
            <LogOut />
            <span>Sign out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 text-xs">
      <p className="truncate font-medium text-sidebar-foreground">{user.full_name}</p>
      <p className="mt-0.5 truncate text-muted-foreground">{user.email}</p>
      {membership ? (
        <p className="mt-2 text-muted-foreground">
          {membership.organization_name} · {membership.role}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-8 w-full justify-start px-2"
        onClick={onLogout}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    </div>
  );
}

function ShellBody({ children, active, user }) {
  const router = useRouter();
  const { setMobileOpen } = useSidebar();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between gap-1">
            <BrandBlock />
            <HeaderActions />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workbench</SidebarGroupLabel>
            <SidebarMenu>
              {nav.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href} onClick={() => setMobileOpen(false)}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <PipelineHint />
          <SidebarSeparator />
          <CollapsedTheme />
          <UserBlock user={user} onLogout={onLogout} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">TradeDoc OCR</p>
            <p className="truncate text-xs text-muted-foreground">Electronics LC packs</p>
          </div>
          <ThemeToggle className="md:hidden" />
        </header>
        <div className="animate-fade-in flex-1 p-4 md:p-8">{children}</div>
      </SidebarInset>
    </>
  );
}

export function AppShell({ children, active, user }) {
  return (
    <SidebarProvider defaultOpen>
      <ShellBody active={active} user={user}>
        {children}
      </ShellBody>
    </SidebarProvider>
  );
}
