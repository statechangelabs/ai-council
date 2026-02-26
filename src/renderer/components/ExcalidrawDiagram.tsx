import React, { lazy, Suspense } from "react";

const ExcalidrawInner = lazy(async () => {
  const mod = await import("@excalidraw/excalidraw");
  const Excalidraw = mod.Excalidraw;
  return {
    default: ({ elements }: { elements: unknown[] }) => (
      <div className="h-[500px] w-full border rounded-lg overflow-hidden">
        <Excalidraw
          initialData={{
            elements: elements as any,
            appState: { viewBackgroundColor: "transparent" },
          }}
          viewModeEnabled={false}
          UIOptions={{ canvasActions: { saveAsImage: true } }}
        />
      </div>
    ),
  };
});

export function ExcalidrawDiagram({ elements }: { elements: unknown[] }) {
  return (
    <Suspense
      fallback={
        <div className="h-[500px] w-full border rounded-lg flex items-center justify-center text-muted-foreground">
          Loading diagram...
        </div>
      }
    >
      <ExcalidrawInner elements={elements} />
    </Suspense>
  );
}
