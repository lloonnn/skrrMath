import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { FileTextIcon, NotebookPenIcon } from "lucide-react"

const notes = [
  { name: "Blank notes", icon: <FileTextIcon /> },
  { name: "Scratch pad", icon: <NotebookPenIcon /> },
]

export function NavNotes() {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Notes</SidebarGroupLabel>
      <SidebarMenu>
        {notes.map((note) => (
          <SidebarMenuItem key={note.name}>
            <SidebarMenuButton render={<button type="button" />}>
              {note.icon}
              <span>{note.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
