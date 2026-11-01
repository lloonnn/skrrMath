"use client"

import * as React from "react"

import { NavCourses } from "@/components/nav-courses"
import { NavNotes } from "@/components/nav-notes"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Course } from "@/features/papers/sample-papers"
import {
  LifeBuoyIcon,
  PlusIcon,
  Settings2Icon,
  SigmaIcon,
} from "lucide-react"

const secondary = [
  { title: "Settings", url: "#", icon: <Settings2Icon /> },
  { title: "Help", url: "#", icon: <LifeBuoyIcon /> },
]

// Placeholder user. Replaced by the signed-in Supabase user.
const user = {
  name: "Signed in",
  email: "name@example.com",
  avatar: "",
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  courses: Course[]
  activePaperId: string | null
  onSelectPaper: (paperId: string) => void
}

export function AppSidebar({
  courses,
  activePaperId,
  onSelectPaper,
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
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New paper"
                render={<button type="button" />}
              >
                <PlusIcon />
                <span>New paper</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <NavCourses
          courses={courses}
          activePaperId={activePaperId}
          onSelectPaper={onSelectPaper}
        />
        <NavNotes />
        <NavSecondary items={secondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
