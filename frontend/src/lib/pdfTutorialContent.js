const lessons = [
  ['Getting around', [
    'Use Expand if the toolbar is collapsed. Drawing tools sit alongside Insert, Pages, View and More tools.',
    'Open View → Toolbar position to place it at the top, bottom or either side. Editor layout lets you hide individual controls. Zen mode hides the controls while keeping your current tool. Press Esc to exit Zen mode.',
    'Use View → Tab icon color to give this document a distinct browser tab color.'
  ], 'Open View and find Toolbar position.'],
  ['Reading and navigation', 'Select text mode lets you select and copy PDF text. Continuous scrolling displays pages together. Pages provides thumbnails, previous/next navigation and a Side page for reference. View provides zoom, fit width, rotation, fullscreen and dark pages.', 'Open Pages and try the thumbnails. Use View → Fit page width to reset your zoom.'],
  ['Find text', 'Find searches all pages, text annotations and sticky notes. Select a result to jump to its page. Scanned pages, handwriting and images require OCR to become searchable.', 'Open Find and search for a word in your document.'],
  ['Pen and highlighter', [
    'Choose Pen or Highlighter, then select a color and brush size. Set pressure and stylus behavior for a supported pen.',
    'Enable the corresponding detection in More tools to tidy drawn lines. Draw at least four dots for a dotted line or three short strokes for a dashed line. For a number line, draw a long axis and at least three evenly spaced crossing ticks.',
    'If the detected result is off, choose Undo to restore the original strokes.'
  ], 'Choose a pen color and size, then draw on a spare page.'],
  ['Erasing and selecting', [
    'Use Erase with the stroke, precision or object option. Set the size and shape to match what you want to remove.',
    'Press V to switch to Move, then select an object. Use the movement handle to drag, the corner handles to resize, and the rotation handle where available to turn it. Use arrow keys to nudge a selected insert.',
    'Use Undo or Redo in the toolbar to revisit supported changes.'
  ], 'Select an insert and inspect its corner handles.'],
  ['Text editing', 'Choose Text and click blank space to type. Click supported existing PDF text to replace it. The text toolbar changes font size and color. Use corner handles to change wrapping. Replacement quality depends on the source text and available fonts.', 'Add a short text box. Finish with Escape, then select it to move it.'],
  ['Sticky notes', [
    'Choose More tools → Sticky note to place an editable note. Type a reminder and use Note color to change its background.',
    'Select Handwrite and draw inside the note with a mouse, pen or touch. Choose Done handwriting when finished. Typed text and ink can stay on the same note.',
    'Select the note to resize, move or rotate it. Check the result in an annotated export if you need to share the note outside the editor.'
  ], 'Add a sticky note, type a reminder, then choose its background color.'],
  ['Files, shapes, tables and stamps', 'Insert supports images and files, shapes, tables and stamps. Media inserts can be moved and resized. As you drag media, pink guides show alignment with page edges, centers and other media. Hold Alt to bypass snapping. Align offers precise page positioning.', 'Open Insert and inspect the available types.'],
  ['Copying regions', 'More tools → Copy region captures a selected area for Paste snippet. Arrow copy lets you select an area, draw an arrow, review a translucent preview and choose Paste copy. Source content remains on the page.', 'Try Copy region on a small area, then Paste snippet.'],
  ['Managing pages', 'Pages can add a blank page or delete the current page while keeping at least one. Insert → Pages imports PDF pages or duplicates a page. Set placement and optional page ranges, then confirm. Drag thumbnails to reorder pages.', 'Open Insert → Pages and review placement and range controls.'],
  ['Ruler, math and graphs', 'More tools includes Ruler, Calculator, Calculate selected region, Scan function, Graph selected region and number-line tools. Ruler draws a straight annotation and displays its length in PDF points. Review recognized expressions before calculating or inserting a result.', 'Open More tools and find Ruler and Calculator.'],
  ['Touch and stylus', [
    'One finger scrolls by default. Switch the 1 finger control to drawing when you want a finger to make marks, then switch it back when you want to scroll.',
    'Lock page to hold the view steady while you write. Unlock it before moving to another part of the document.',
    'Use Scroll & glide to tune scrolling and stopping. Use Stylus setup for supported pen buttons and the eraser. Move the toolbar under View if another side is easier to reach.'
  ], 'Open Scroll & glide and inspect the movement controls.'],
  ['Study and AI tools', 'The countdown, stopwatch and Study Phone help with study sessions. The AI assistant and Clean up PDF support available document workflows. AI features require your Gemini key and the relevant Account → AI access permissions. Review proposed changes before applying them.', 'Open More tools to find timers and Document to find Clean up PDF.'],
  ['Saving and exporting', 'Save stores editor changes in your account. Document → Download annotated PDF exports ink, text and inserts. Download without annotations exports the current pages alone. Use Create copy with annotations to keep an editable duplicate, or Create copy without annotations for a separate clean document. Document settings edits the name, folder and tags. The folder sidebar switches files or creates a new one.', 'Check the save status, then locate Download annotated PDF under Document.'],
  ['Offline editing', 'In the Documents library, make an unlocked PDF available offline before disconnecting. Offline annotations save on the device and sync when you reconnect with the app open. Review conflicts in the offline panel. Sync pending changes before signing out, which clears offline storage.', 'Return to Documents when ready and find Make available offline on the file.'],
  ['Quick actions from a PDF', [
    'Press N outside a text field in an editable PDF, or choose Quick actions when available.',
    'Choose New task, enter a title and optional due date, and create it. Choose New calendar event for a timed or all-day event. Check the displayed time zone for timed entries.',
    'Use the links in Quick actions to open Tasks, Calendar or Workspace in a new tab while leaving the document open.'
  ], 'In the editor, press N outside a text field, then inspect the timed and all-day options.'],
  ['Unit circle and trigonometry', [
    'Open Insert, switch to Shapes, and choose Unit circle to place a reference with angles in degrees and radians and exact cosine and sine coordinates.',
    'Choose Trig reference to insert exact sine, cosine and tangent values with labeled 30°–60°–90° and 45°–45°–90° triangles.',
    'Switch to Move to position the reference on the page and resize it with its handles.'
  ], 'Insert both references on a spare page and arrange them side by side.'],
  ['Shared editing and whiteboards', [
    'For a shared PDF or board, check your role before editing. Open the sharing controls to see available permissions and use the presence indicators when collaborating.',
    'On a whiteboard, find background color and pattern controls in View. Open Sections → Extend whiteboard, or extend from the bottom of the canvas when you need more space.',
    'Use the same drawing, text and sticky-note tools on the extended canvas.'
  ], 'Open a whiteboard and locate the appearance settings and Extend whiteboard.']
]

export const pdfTutorialTopic = {
  topic: 'PDF editor',
  lessons: lessons.map(([title, description, practice]) => ({
    id: 'pdf-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title,
    route: 'documents',
    destination: 'Documents',
    steps: Array.isArray(description) ? description : [description],
    practice,
    editorShortcuts: true,
  })),
}
