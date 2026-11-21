# MSE Inspection Autofill (Chrome extension)

This extension fills the Internal Audit Report chapter pages on `inspection-os.msei.in` using the Annexure II Excel.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Reload any MSE tab that is already open.

## Use
1. Click the extension icon and choose the filled Annexure II `.xlsx`. The file is stored in the extension, so you only upload it again when it changes.
2. Open a chapter page, then click **Autofill from Excel** (bottom left) or **Fill this chapter** in the popup. You can also load the Excel with the **Load Excel** button on the page.
3. Review the page and click **Save** / **Save & Continue** yourself. The extension never submits the form.

Turn on "Fill each chapter automatically" if you want each chapter filled as soon as it opens after Save & Continue.

## Excel mapping
| Excel | Portal |
|---|---|
| Column B on the chapter header row (A = 0) | Chapter Id on the page |
| Column E, Area of Verification (falls back to column D, S.No) | Row match |
| F: C / NC / N.A | Compliance Status (Complied / Not Complied / Not Applicable) |
| G: Sample size verified | No. of samples verified |
| H | No. of instances of non-compliance |
| I | % of instances |
| J | Amount/value involved |
| Any column with "Remarks" in its header (optional) | Remarks |

Chapters with no checkpoints (22 and 23) take their status from the chapter header row.

## Notes
- The portal blocks typing `" ' ; =` and `-`. The extension removes those characters and turns `-` into a space.
- Changing a status on the portal normally reloads the whole page. The extension sets the statuses without that reload, and they are sent when you click Save. If Save ever rejects them, turn on "Run the portal's status-change refresh".
- Row colours: green means matched by checkpoint text, orange means matched by S.No only (check it), and red means no Excel row was found.
- Boxes that already have values are kept unless "Overwrite" is on.

## Release
- `python build.py` builds `dist/mse-inspection-autofill-<version>.zip` for the Chrome Web Store. The store build only has access to the live portal.
- Listing text, permission justifications and privacy answers: [store/LISTING.md](store/LISTING.md). Images are in `store/`.
- Privacy policy (GitHub Pages, from `docs/`): https://it-theska-in.github.io/MSEI/

## Testing offline (mock site)
`mock-site/` (not in git) holds a copy of the saved chapter page and a small Node server. Nothing is sent to the real portal.

1. Double-click `mock-site/start-mock-site.bat`. A server window opens, then Chrome opens the mock chapter page.
2. Load `mock/Annexure II - MOCK TEST.xlsx` and click **Autofill from Excel**.
3. Click **Save**. The mock server sends the page back with a yellow banner that lists every value it received.

Close the server window to stop the mock site.
