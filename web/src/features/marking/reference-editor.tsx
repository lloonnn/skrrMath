import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  MAX_TEXT,
  imageToReference,
  referenceImageUrl,
  type Reference,
} from "@/features/marking/reference"
import { uid } from "@/lib/uid"

// "Your correct answer" for one question: type it, or add a picture of it (a photo
// of your lecturer's solution, for example). The AI then checks your lines against it
// instead of solving the question itself.
export function ReferenceEditor({
  reference,
  onChange,
}: {
  reference: Reference | undefined
  onChange: (r: Reference | undefined) => void
}) {
  const [text, setText] = React.useState(
    reference?.kind === "text" ? reference.text : ""
  )
  const [error, setError] = React.useState<string | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  async function addImage(file: Blob) {
    setError(null)
    try {
      setText("")
      onChange(await imageToReference(file, uid()))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that picture.")
    }
  }

  return (
    <Collapsible defaultOpen={reference !== undefined}>
      <CollapsibleTrigger className="text-xs text-muted-foreground underline">
        Correct answer (optional){reference ? " - added" : ""}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className="mt-2 flex flex-col gap-2"
          // A picture pasted while this area is focused is added as the answer.
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) =>
              f.type.startsWith("image/")
            )
            if (file) {
              e.preventDefault()
              void addImage(file)
            }
          }}
        >
          <p className="text-xs text-muted-foreground">
            The AI marks your answer against this.
          </p>

          {reference?.kind === "image" ? (
            <div className="flex flex-col gap-2">
              <img
                src={referenceImageUrl(reference)}
                alt="Your correct answer"
                className="max-h-48 w-full border object-contain"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null)
                  onChange(undefined)
                }}
              >
                Remove picture
              </Button>
            </div>
          ) : (
            <>
              <textarea
                value={text}
                maxLength={MAX_TEXT}
                rows={3}
                placeholder="Type the correct answer"
                className="w-full resize-y rounded-md border bg-background p-2 text-sm"
                onChange={(e) => {
                  const value = e.target.value
                  setText(value)
                  onChange(
                    value.trim()
                      ? { kind: "text", text: value, rev: uid() }
                      : undefined
                  )
                }}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void addImage(f)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInput.current?.click()}
              >
                Add a picture instead
              </Button>
            </>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
