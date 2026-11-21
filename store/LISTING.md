# Chrome Web Store submission kit

Upload `dist/mse-inspection-autofill-<version>.zip`. Build it with `python build.py`.
Developer dashboard: https://chrome.google.com/webstore/devconsole

## Store listing tab

**Name**
MSE Inspection Autofill

**Summary** (132 characters max)
Fill MSE internal audit report chapters from your Annexure II Excel in one click. Runs locally; no data leaves your browser.

**Category:** Productivity → Workflow & Planning
**Language:** English

**Description**
```
MSE Inspection Autofill saves auditors from re-typing the Annexure II working paper into the MSE inspection portal, one checkpoint at a time.

HOW IT WORKS
1. Click the extension icon and choose your filled Annexure II Excel (.xlsx). You only do this once.
2. Open any chapter of the Internal Audit Report on inspection-os.msei.in.
3. Click "Fill this chapter". The chapter is filled in seconds. Nothing is filled until you click.
4. Review the page and click Save yourself. The extension never submits anything for you.

WHAT IT FILLS
• Compliance status: C → Complied, NC → Not Complied, N.A → Not Applicable
• No. of samples verified
• No. of instances where non-compliance is observed
• % of instances, shown as 6% even when Excel stores it as 0.06
• Amount/value involved
• Remarks, from an optional "Remarks" column or a default remark you set for N.A / NC rows

BUILT FOR ACCURACY
• Matches each portal row to the Excel by the checkpoint wording, so re-ordered rows still land in the right place. Falls back to S.No.
• Colours every field it touches: green = matched by wording, orange = matched by S.No only (check it), red = no Excel row found.
• Shows a summary of anything it couldn't match.
• Keeps values already on the page unless you turn on Overwrite.
• Removes characters the portal rejects (" ' ; = -) and respects field length limits.

PRIVATE BY DESIGN
Everything runs in your browser. The Excel is stored only in Chrome's local extension storage on your computer. Nothing is sent to the developer or any third party, and the extension has no analytics or tracking. It only runs on inspection-os.msei.in.

MSE Inspection Autofill is an independent tool. It is not affiliated with or endorsed by Metropolitan Stock Exchange of India Ltd.
```

**Graphic assets** (in `store/`)
| Asset | File | Required size |
|---|---|---|
| Store icon | `store-icon-128.png` | 128×128 |
| Screenshot 1 | `screenshot-1-filled-chapter.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-popup.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |

**Official URL / Homepage URL:** https://it-theska-in.github.io/MSEI/
**Support URL:** https://github.com/it-theska-in/MSEI/issues

## Privacy practices tab

**Single purpose**
```
Fills the Internal Audit Report chapter pages on the MSE inspection portal (inspection-os.msei.in) with values from the auditor's Annexure II Excel file.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Keeps the parsed Annexure II Excel data and the user's settings in local extension storage, so the file is uploaded once and reused on every chapter page. Nothing is synced or transmitted. |
| `activeTab` | Lets the popup read the open portal tab's chapter number and fill it when the user clicks "Fill this chapter". |
| `scripting` | If the portal tab was opened before the extension was installed or updated, the popup injects the extension's own packaged content script into that tab so the fill can run without a reload. No remote code is injected. |
| Host permission `https://inspection-os.msei.in/*` | The extension only works on this portal. It needs access to read the open chapter and fill the audit form fields when the user clicks "Fill this chapter". |

**Remote code:** No, I am not using remote code. All JavaScript ships in the package. There is no eval and no external scripts.

**Data usage**: tick **none** of the data-type boxes. The extension does not collect or transmit user data. The Excel contents and page content are processed and stored only on the user's device.

Tick all three certifications:
- I do not sell or transfer user data to third parties, apart from the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://it-theska-in.github.io/MSEI/

## Distribution tab
- **Visibility:** Public, or **Unlisted** if only your team should find it (anyone with the link can install it)
- **Regions:** India, or all regions

## Before you submit
- [ ] Bump `version` in `manifest.json` for every new upload, then run `python build.py`
- [ ] Privacy URL loads: https://it-theska-in.github.io/MSEI/
- [ ] Developer account is registered (one-time US$5 fee) and the contact email is verified
