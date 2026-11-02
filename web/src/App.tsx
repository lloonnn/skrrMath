import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { NoteCanvas } from "@/features/canvas/note-canvas"
import { sampleCourses } from "@/features/papers/sample-papers"

export function App() {
  const [activePaperId, setActivePaperId] = React.useState<string | null>(
    sampleCourses[0]?.years[0]?.papers[0]?.id ?? null
  )

  return (
    <SidebarProvider>
      <AppSidebar
        courses={sampleCourses}
        activePaperId={activePaperId}
        onSelectPaper={setActivePaperId}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="min-h-0 flex-1">
          <NoteCanvas />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
