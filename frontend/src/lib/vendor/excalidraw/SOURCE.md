# Excalidraw input adaptations

Source version: v0.18.0 (MIT).

- https://github.com/excalidraw/excalidraw/blob/v0.18.0/packages/excalidraw/gesture.ts
- https://github.com/excalidraw/excalidraw/blob/v0.18.0/packages/excalidraw/components/App.tsx
- https://github.com/excalidraw/excalidraw/blob/v0.18.0/LICENSE

`pointerInput.js` adapts `getCenter`, `sum`, and the `allowOnPointerDown`
condition from these sources. Type annotations were removed, PDF tool names
were substituted, and an empty-map guard was added. The pen-input check
corresponds to the source's `event.pointerType === "pen"` detection.

The PDF gesture hook integrates these helpers with the existing annotation
and page-scrolling code. It does not embed Excalidraw or claim to supply
hardware palm classification. Contact dimensions and pressure are not used
to guess whether an input is a pen or a palm. Scroll/Draw remain explicit,
pen contact takes priority, and a two-pointer gesture pans the page.

The complete upstream MIT license is included in LICENSE.
