import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import type { Course } from "@/features/papers/sample-papers"
import { ChevronRightIcon, FolderIcon } from "lucide-react"

export function NavCourses({
  courses,
  activePaperId,
  onSelectPaper,
}: {
  courses: Course[]
  activePaperId: string | null
  onSelectPaper: (paperId: string) => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Courses</SidebarGroupLabel>
      <SidebarMenu>
        {courses.map((course) => (
          <Collapsible key={course.code} defaultOpen render={<SidebarMenuItem />}>
            <CollapsibleTrigger
              render={<SidebarMenuButton tooltip={course.name} className="group" />}
            >
              <FolderIcon />
              <span>{course.name}</span>
              <ChevronRightIcon className="ml-auto transition-transform group-aria-expanded:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {course.years.map((year) => (
                  <Collapsible
                    key={year.year}
                    defaultOpen
                    render={<SidebarMenuSubItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuSubButton
                          className="group"
                          render={<button type="button" />}
                        />
                      }
                    >
                      <span>{year.year}</span>
                      <ChevronRightIcon className="ml-auto transition-transform group-aria-expanded:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {year.papers.map((paper) => (
                          <SidebarMenuSubItem key={paper.id}>
                            <SidebarMenuSubButton
                              isActive={paper.id === activePaperId}
                              render={
                                <button
                                  type="button"
                                  onClick={() => onSelectPaper(paper.id)}
                                />
                              }
                            >
                              <span>{paper.title}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {paper.marked}/{paper.total}
                              </span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
