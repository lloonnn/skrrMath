import * as React from "react"
import { PanelRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { MarkingMargin } from "@/features/marking/marking-margin"
import { NoteCanvas } from "@/features/canvas/note-canvas"
import { sampleCourses } from "@/features/papers/sample-papers"

export function App() {
  const [activePaperId, setActivePaperId] = React.useState<string | null>(
    sampleCourses[0]?.years[0]?.papers[0]?.id ?? null
  )

  const [marginOpen, setMarginOpen] = React.useState(true)

  return (
    <SidebarProvider>
      <AppSidebar
        courses={sampleCourses}
        activePaperId={activePaperId}
        onSelectPaper={setActivePaperId}
      />
      <SidebarInset>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Button
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                aria-label={
                  marginOpen ? "Close marking panel" : "Open marking panel"
                }
                title={
                  marginOpen ? "Close marking panel" : "Open marking panel"
                }
                onClick={() => setMarginOpen((o) => !o)}
              >
                <PanelRight />
              </Button>
            </header>
            <div className="min-h-0 flex-1">
              <NoteCanvas />
            </div>
          </div>
          <MarkingMargin open={marginOpen} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
