"use client"

import * as React from "react"
import { SigmaIcon } from "lucide-react"

import type { Session } from "@supabase/supabase-js"
import type { PaperTree } from "@shared/index.ts"
import { NavCourses, type CourseActions } from "@/components/nav-courses"
import { UserBox } from "@/features/auth/user-box"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  tree: PaperTree
  activeId: string | null
  onOpen: (yearId: string) => void
  actions: CourseActions
  session: Session | null
  onOpenLecturer: () => void
}

export function AppSidebar({
  tree,
  activeId,
  onOpen,
  actions,
  session,
  onOpenLecturer,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="#" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SigmaIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">skrrMath</span>
                <span className="truncate text-xs">Past paper practice</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavCourses
          tree={tree}
          activeId={activeId}
          onOpen={onOpen}
          actions={actions}
        />
      </SidebarContent>
      <SidebarFooter>
        <UserBox session={session} onOpenLecturer={onOpenLecturer} />
      </SidebarFooter>
    </Sidebar>
  )
}
