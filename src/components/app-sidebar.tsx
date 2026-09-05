import { Link, useRouterState } from "@tanstack/react-router";
import { Gauge, History, ListChecks, ScanLine, Sparkles } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";

import { listInvoices } from "@/lib/invoices.functions";

const items = [
  { title: "Dashboard", url: "/", icon: Gauge },
  { title: "Upload Invoice", url: "/upload", icon: ScanLine },
  { title: "Review Queue", url: "/review", icon: ListChecks, needsReviewBadge: true },
  { title: "Invoice History", url: "/history", icon: History },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const reviewCount = useQuery({
    queryKey: ["review-count"],
    queryFn: () =>
      listInvoices({ data: { statuses: ["needs-review"], page: 0, pageSize: 1 } }).then(
        (r) => r.total,
      ),
  }).data;
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                InvoiceAI
              </span>
              <span className="text-[11px] text-muted-foreground">Automation platform</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && "badge" in item && item.badge ? (
                        <span className="rounded bg-warning-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-warning">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-1 py-1 text-[11px] text-muted-foreground">
            MVP preview · mock data only
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
